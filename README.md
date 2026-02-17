# ts-mcp

TypeScript MCP server for AI agents. Symbol-based code navigation, impact analysis, and JSDoc metadata — replacing grep with IDE-level intelligence.

## Prerequisites

- Node.js 22+
- TypeScript project with `tsconfig.json`

## Setup

```bash
npm install -g ts-mcp
```

Add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "ts-mcp": {
      "command": "npx",
      "args": ["ts-mcp", "--workspace", "/path/to/your/project"]
    }
  }
}
```

### Options

| Flag | Description |
|------|-------------|
| `--workspace <path>` | Path to TypeScript project root (default: `cwd`) |
| `--no-cache` | Bypass the symbol index disk cache |
| `--projects <paths>` | Comma-separated list of `tsconfig.json` paths for multi-project workspaces |

## Tools

### Navigation
- `goto_definition` — Jump to a symbol's definition by position
- `find_references` — Find all usages of a symbol by position
- `workspace_symbols` — Find a symbol across the project by exact name
- `document_symbols` — List all symbols defined in a file

### Impact Analysis
- `call_hierarchy` — Find callers or callees of a function
- `type_hierarchy` — Find implementations of an interface or subclasses
- `impact_analysis` — Assess blast radius before modifying a symbol

### Code Intelligence
- `get_type_info` — Get resolved type, docs, and JSDoc tags
- `signature_help` — Get parameter names, types, and overloads
- `rename_symbol` — Compute all edits needed to rename a symbol

### Diagnostics
- `diagnostics` — Get TypeScript errors and warnings

## Multi-Project Support

ts-mcp automatically discovers `tsconfig.json` files in your workspace (up to 3 levels deep). When multiple are found, each gets its own language service instance — tools route to the correct project based on file path.

To explicitly specify projects:

```json
{
  "mcpServers": {
    "ts-mcp": {
      "command": "npx",
      "args": [
        "ts-mcp",
        "--workspace", "/path/to/monorepo",
        "--projects", "/path/to/monorepo/packages/app/tsconfig.json,/path/to/monorepo/packages/shared/tsconfig.json"
      ]
    }
  }
}
```

With a single `tsconfig.json` (or none), behavior is identical to before.

## Scripts

- `npm run build` — Build with tsup
- `npm run dev` — Run with tsx
- `npm test` — Run tests with Vitest
