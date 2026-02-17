# Bug Report: darkknight project session (2026-02-17)

## Environment

- **Project**: darkknight (TypeScript CLI tool, npm)
- **ts-mcp**: v0.2.0-beta.1
- **TypeScript**: 5.9.3
- **Node**: v24.13.1
- **OS**: macOS Darwin 25.2.0

## Test Results Summary

| Tool | Status | Notes |
|------|--------|-------|
| `diagnostics` | OK | Found real issue (unused param) |
| `find_references` | OK | All 10 refs for `RiskPattern` found |
| `call_hierarchy` | OK | Works with correct position |
| `impact_analysis` | BUG | `implementations` returns full source code |
| `document_symbols` | BUG | Returns local vars, callbacks, duplicates |
| `goto_definition` | OK | Not tested (working from prior sessions) |
| `workspace_symbols` | OK | Not tested (working from prior sessions) |

## Bug 1: `document_symbols` returns excessive symbols

### Severity: High (token waste, unusable output)

### Symptom

Calling `document_symbols` on `src/analyzer.ts` (250 lines) returns **100+ symbols**
including every local variable, callback, and object property.

### Examples of noise

```json
{"name": "content", "kind": "const", "line": 42}           // local in for-loop
{"name": "parsed.fileNames.filter() callback", "kind": "function", "line": 71}
{"name": "modifiers.some() callback", "kind": "function", "line": 213}
{"name": "key", "kind": "const", "line": 184}               // local in for-loop
{"name": "isExported", "kind": "property", "line": 159}     // appears 5 times
{"name": "directRefs", "kind": "property", "line": 159}     // appears 4 times
```

### Expected behavior

Only module-level and exported symbols:

```json
{"name": "AnalyzeOptions", "kind": "interface", "line": 12}
{"name": "analyze", "kind": "function", "line": 20}
{"name": "computeMetrics", "kind": "function", "line": 150}
{"name": "checkIsExported", "kind": "function", "line": 200}
{"name": "computeSeverity", "kind": "function", "line": 231}
{"name": "matchGlob", "kind": "function", "line": 244}
```

~6 useful symbols vs 100+ noise symbols.

### Root cause hypothesis

The implementation likely uses `ts.NavigationTree` with full depth or iterates
all AST nodes. Should filter to module-scope declarations only or limit depth
to top-level + immediate children.

### Impact

- Token waste: ~5000 tokens for a 250-line file
- Agent overwhelmed by noise — cannot efficiently identify file structure
- Defeats the purpose of the tool (quick file overview)

---

## Bug 2: `impact_analysis` implementations contain full source code

### Severity: Medium (token waste)

### Symptom

The `implementations` field in `impact_analysis` response returns the entire
source code of implementing object literals.

### Reproduction

```json
// Request
{"name": "impact_analysis", "arguments": {"file": "src/types.ts", "line": 5, "column": 18}}

// Response (abbreviated)
{
  "implementations": [
    {
      "name": "{\n  name: 'as-any',\n  baseSeverity: 'medium',\n\n  detect(node: ts.Node...(500+ chars)",
      "file": "src/patterns/as-any.ts",
      "line": 4
    }
  ]
}
```

### Expected behavior

```json
{
  "implementations": [
    {"name": "asAnyPattern", "file": "src/patterns/as-any.ts", "line": 4},
    {"name": "anyParamPattern", "file": "src/patterns/any-param.ts", "line": 4}
  ]
}
```

### Root cause hypothesis

For object literal implementations of interfaces, the `name` field uses the
full text span of the expression instead of the variable name it's assigned to.
Should resolve to the containing variable/const declaration name.

### Impact

- Token waste: ~2000 tokens per implementation (entire object source)
- Information is redundant — agent can read the file if needed

---

## Observation: Mid-session `ts-mcp --init` does not activate MCP tools

### Not a bug — expected behavior

Running `ts-mcp --init` during a Claude Code session creates `.mcp.json` and
`.claude/CLAUDE.md`, but the MCP server is only loaded at session startup.
The tools are not available until the next session.

### Workaround

Run `ts-mcp --init` before starting the Claude Code session, or restart the
session after initialization.

---

## Positive findings

1. **npm project works perfectly** — no module resolution issues (unlike pnpm)
2. **diagnostics** caught a real unused parameter that `tsc --noEmit` missed
   (because tsconfig has `noUnusedParameters` off but LS reports suggestions)
3. **find_references** complete and accurate across all project files
4. **call_hierarchy** works correctly with proper positioning
5. **impact_analysis** risk assessment and affected files are accurate
