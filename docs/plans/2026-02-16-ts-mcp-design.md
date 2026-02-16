# ts-mcp Design

TypeScript 전용 MCP 서버. 에이전트가 grep 대신 심볼 기반으로 코드를 탐색하고, 수정 전 영향 범위를 파악할 수 있게 한다.

## Problem

에이전트의 현재 코드 탐색 방식:

- grep으로 텍스트 매칭 → 심볼 관계를 모름
- 수정 → tsc → 에러 → 수정 반복 (trial & error)
- JSDoc 메타데이터(@deprecated 등) 인지 불가

IDE는 이미 심볼 탐색, 영향 분석, 타입 정보를 제공하지만 에이전트는 접근할 수 없다.

## Existing Solutions

| Project | Stars | Approach | Gap |
|---------|-------|----------|-----|
| mcp-language-server | 1.4k | Go, LSP bridge | Call/Type Hierarchy 미지원 |
| lsmcp | 437 | TS, LSP bridge | Call/Type Hierarchy 미지원 |
| CodeMCP | 58 | SCIP indexer | TS Tier 2 (불완전) |
| code-graph-mcp | 79 | ast-grep | Type Hierarchy 미지원, 타입 분석 없음 |

어떤 MCP 서버도 TypeScript의 Call Hierarchy, Type Hierarchy, 수정 전 영향 분석을 제공하지 않는다.

## Approach

TypeScript Language Service API를 직접 사용한다.

선택 이유:

- Impact Analysis와 Type Hierarchy는 타입 시스템 직접 접근 없이 불가능
- JSDoc 커스텀 태그 파싱이 Compiler API로 자연스러움
- IPC 오버헤드 없음 (in-process)
- LSP 확장은 실제로 필요해질 때 추가 (YAGNI)

기각된 대안:

- **LSP bridge**: typescript-language-server 래핑. LSP가 노출하는 것만 사용 가능, 커스텀 JSDoc 접근 어려움
- **Hybrid**: TS Language Service + LSP 인터페이스. 초기 추상화 비용 대비 이점 불명확

## Architecture

```
┌─────────────┐     MCP (stdio)     ┌──────────────────┐
│ Claude Code  │ ◄─────────────────► │    ts-mcp        │
│ (MCP Client) │                     │                  │
└─────────────┘                     │  ┌────────────┐  │
                                     │  │ MCP Layer  │  │
                                     │  │ (tools)    │  │
                                     │  └─────┬──────┘  │
                                     │        │         │
                                     │  ┌─────▼──────┐  │
                                     │  │ TS Service  │  │
                                     │  │ (compiler)  │  │
                                     │  └─────┬──────┘  │
                                     │        │         │
                                     │  ┌─────▼──────┐  │
                                     │  │ Project     │  │
                                     │  │ (tsconfig)  │  │
                                     │  └────────────┘  │
                                     └──────────────────┘
```

Three layers:

- **MCP Layer** — MCP SDK tool definitions, I/O serialization
- **TS Service Layer** — TypeScript Language Service wrapper, caching, result formatting
- **Project Layer** — tsconfig loading, file watching, project state management

Communication: stdio (Claude Code default).

## TypeScript Version Resolution

Resolved once at server startup, locked for the session.

```
1. {workspace}/node_modules/typescript  ← project-local (priority)
2. ts-mcp bundled typescript             ← fallback
```

Project-local version matches the project's tsconfig and @types. Bundled fallback provides basic analysis when node_modules is absent.

## MCP Tools

### Navigation

| Tool | Input | Output | Purpose |
|------|-------|--------|---------|
| `goto_definition` | file, line, column | Definition location + source | Where a symbol is defined |
| `find_references` | file, line, column | Reference locations | Where a symbol is used |
| `workspace_symbols` | query (name pattern) | Matching symbols | Search symbols across project |
| `document_symbols` | file | Symbol tree | File structure without reading |

### Impact Analysis

| Tool | Input | Output | Purpose |
|------|-------|--------|---------|
| `call_hierarchy` | file, line, column, direction | Incoming/outgoing call tree | Who calls this function |
| `type_hierarchy` | file, line, column | Implementation/inheritance tree | Who implements this interface |
| `impact_analysis` | file, line, column | Affected files/symbols + risk | Pre-modification blast radius |

`impact_analysis` is a composite tool that combines `find_references` + `call_hierarchy` + `type_hierarchy` to calculate blast radius in a single call.

### Code Intelligence

| Tool | Input | Output | Purpose |
|------|-------|--------|---------|
| `signature_help` | file, line, column | Parameter info + overloads | Accurate function arguments |
| `get_type_info` | file, line, column | Resolved type + JSDoc | Inferred type inspection |
| `rename_symbol` | file, line, column, newName | Edit locations | Safe renaming across project |

### Diagnostics

| Tool | Input | Output | Purpose |
|------|-------|--------|---------|
| `diagnostics` | file (or all) | Error/warning list | Instant errors without running tsc |

## JSDoc/TSDoc

### Standard Tags

All symbol-returning tools include JSDoc metadata in responses:

```json
{
  "symbol": "getUser",
  "type": "(id: string) => Promise<User>",
  "jsdoc": {
    "deprecated": { "message": "Use fetchUserById instead" },
    "params": [{ "name": "id", "description": "User ID" }],
    "returns": "User object or null",
    "throws": ["UserNotFoundError"],
    "see": ["fetchUserById"]
  }
}
```

### Custom Tags

`@ts-mcp-` prefix for agent-specific annotations:

```typescript
/**
 * @ts-mcp-caution Modifying this breaks payment flow
 * @ts-mcp-owner payment-team
 * @ts-mcp-invariant balance >= 0
 */
```

Exposed as `customTags` in responses:

```json
{
  "customTags": {
    "caution": "Modifying this breaks payment flow",
    "owner": "payment-team",
    "invariant": "balance >= 0"
  }
}
```

v1: standard tags first. Custom tag parsing infrastructure ready, specific tag vocabulary evolves with usage.

## Tech Stack

| Item | Choice | Reason |
|------|--------|--------|
| Runtime | Node.js | TS Language Service is Node-based |
| Language | TypeScript | |
| MCP SDK | @modelcontextprotocol/sdk | Official SDK |
| TS API | typescript (Language Service API) | Core engine |
| Build | tsup | Fast bundling, ESM/CJS |
| Test | Vitest | Project standard |

## Project Structure

```
ts-mcp/
├── src/
│   ├── index.ts              # MCP server entrypoint
│   ├── server.ts             # MCP tool registration & routing
│   ├── tools/                # MCP Layer
│   │   ├── navigation.ts     # goto_definition, find_references, ...
│   │   ├── impact.ts         # call_hierarchy, type_hierarchy, impact_analysis
│   │   ├── intelligence.ts   # signature_help, get_type_info, rename_symbol
│   │   └── diagnostics.ts    # diagnostics
│   ├── service/              # TS Service Layer
│   │   ├── language-service.ts  # TS Language Service wrapper
│   │   ├── jsdoc-parser.ts      # JSDoc/TSDoc metadata extraction
│   │   └── impact-analyzer.ts   # Blast radius calculation
│   └── project/              # Project Layer
│       ├── config-loader.ts  # tsconfig loading
│       └── file-watcher.ts   # File change detection
├── tests/
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Usage

```json
// ~/.claude/mcp.json
{
  "mcpServers": {
    "ts-mcp": {
      "command": "npx",
      "args": ["ts-mcp", "--workspace", "/path/to/project"]
    }
  }
}
```

## Scope

**v1 In**: 11 tools, standard JSDoc, custom tag infrastructure, stdio
**v1 Out**: LSP extension, SSE, multi-project, incremental indexing optimization
