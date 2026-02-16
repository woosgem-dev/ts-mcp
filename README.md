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

## Tools

### Navigation
- `goto_definition` — Find where a symbol is defined
- `find_references` — Find all locations where a symbol is used
- `workspace_symbols` — Search symbols across the project
- `document_symbols` — List symbols in a file (outline)

### Impact Analysis
- `call_hierarchy` — Find incoming/outgoing calls
- `type_hierarchy` — Find implementations of interfaces
- `impact_analysis` — Pre-modification blast radius

### Code Intelligence
- `get_type_info` — Type information and JSDoc metadata
- `signature_help` — Function parameters and overloads
- `rename_symbol` — Safe rename locations

### Diagnostics
- `diagnostics` — Errors and warnings without running tsc

## Scripts

- `npm run build` — Build with tsup
- `npm run dev` — Run with tsx
- `npm test` — Run tests with Vitest
