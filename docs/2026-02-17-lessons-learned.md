# ts-mcp Lessons Learned

What worked, what broke, and what we'd do differently.

## Architecture decisions

### Direct TS Language Service API — right call

We used TypeScript's Language Service API directly instead of wrapping an LSP server. Two reasons this paid off:

1. No IPC overhead. Everything runs in-process. Symbol lookups, call hierarchy, diagnostics, all without serialization round-trips.
2. Full API access. Things like `prepareCallHierarchy`, `getImplementationAtPosition`, and `getQuickInfoAtPosition` aren't fully exposed through LSP. Going direct let us build `impact_analysis` as a composite tool without hitting protocol walls.

The trade-off is we're locked to TypeScript. No multi-language support. For a TS-specific MCP server, that's an acceptable constraint.

### Three-layer architecture kept things clean

Splitting into Project, Service, and MCP layers made adding tools mechanical. Write a pure function in the Service layer, slap a thin MCP registration wrapper on it, done. Tests hit the Service layer directly without MCP protocol overhead.

## Bugs and fixes

### Workspace path resolution (the big one)

When the server got `--workspace .`, every position-based tool broke. This one was annoying to track down.

`loadTsConfig('.')` returns relative file paths. The `files` Map stored those relative keys. But `resolveFileName()` used `path.resolve()` to produce absolute paths. So Map lookups failed: absolute key vs relative key, no match.

The clue that cracked it: `diagnostics` worked but returned relative paths. `document_symbols` returned `line: 1` for every symbol (empty content means all offsets map to line 1). Meanwhile `workspace_symbols` worked fine because SymbolIndexer reads files on its own, bypassing the Map entirely.

The fix was one line: `this.workspace = path.resolve(workspace)` in the constructor, plus pointing `getCurrentDirectory` at `this.workspace` instead of closing over the raw parameter.

Normalize paths at the boundary. Don't assume callers pass absolute paths.

### MCP sibling error propagation (not fixable)

When Claude Code calls multiple MCP tools in parallel and one fails, it propagates the error to the sibling calls too. This is client-side behavior, not something we can fix on the server.

We wrapped every handler in try-catch and return `isError: true` instead of throwing. Keeps the server alive, but the client may still show errors for the siblings.

### Position bounds checking

Out-of-range line numbers crashed `resolvePosition()` and `toOffset()`. Clamped with `Math.min(line - 1, lines.length)`. Straightforward fix, should have been there from the start.

## MCP tool design

### Tool descriptions are agent instructions

This was a bigger deal than expected. Generic descriptions like "Find where a symbol is defined" were too passive. The agent kept falling back to grep.

Rewriting to directive style actually changed the agent's behavior:
- Before: `"Find where a symbol is defined"`
- After: `"Jump to the definition of a symbol at a given position. Requires file, line, and column. MUST use this instead of grep/ripgrep to find where a symbol is defined."`

Next-step hints also helped. When a tool response ends with "Next: Use find_references to find all usages", the agent chains tools naturally instead of stopping.

### Tool annotations for auto-approval

MCP clients prompt users for permission on each tool call. For a read-only server, that's just friction.

Adding `{ readOnlyHint: true }` to every tool registration tells the client these tools don't modify anything. Clients that respect annotations can auto-approve. Server-side change, fixes a client-side UX problem, no user configuration needed.

### Error responses over exceptions

Throwing from an MCP handler kills the connection. Returning `{ isError: true, content: [...] }` keeps the server running and gives the agent something to work with.

## Development process

### Agent-driven TDD worked

The plan had 16 tasks, each following write-test, run-test, implement, verify. The agent ran through this mechanically and produced working code at each step. The test fixture (a small TS project with interfaces, implementations, and call chains) made this possible. Without a realistic fixture, there's nothing meaningful to test against.

### SymbolIndexer for performance

The first `workspace_symbols` implementation used `getNavigateToItems()` from the Language Service. Worked, but slow on larger projects. Swapping in a pre-built symbol index using TS AST traversal was noticeably faster. The index caches to disk and invalidates by file hash. `--no-cache` forces a rebuild when needed.

## Operational

### Personal info in public repos

Caught this after pushing: local file paths (`/Users/username/...`) in plan documents, and real names in git commit authors on another repo.

1. Scrub docs before committing. Plan documents generated during development will contain local paths. Check before `git add`.
2. Set git config before the first commit, not after. `git config user.name` and `user.email` should be your public identity from the start.

We used `git-filter-repo` to rewrite commit history where names had already been pushed.
