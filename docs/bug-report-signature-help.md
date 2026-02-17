# Bug Report: signature_help returns invalid result

## Summary

`signature_help` tool fails with MCP validation error `-32602` when called
on a valid function call position. The response contains `undefined` in the
`text` field, which violates the MCP tools/call result schema.

## Environment

- **Project**: Next.js 14 + React 18 + Prisma + SASS (pnpm)
- **ts-mcp**: v0.2.0-beta.1 (globally linked via pnpm)
- **TypeScript**: 5.9.3
- **Node**: v24.13.1
- **OS**: macOS Darwin 25.2.0

## Reproduction

Call `signature_help` on any function call site:

```json
{
  "file": "src/lib/skill-sync.ts",
  "line": 40,
  "column": 42
}
```

## Expected

A valid response with function signature information (parameter names, types,
overloads) or an empty result if no signature is available.

## Actual

MCP error:

```
MCP error -32602: MCP error -32602: Result from tools/call did not match the
expected schema for handler signature_help.
```

The error indicates the response object contains `undefined` in a field
(likely `text`) where the schema requires a string.

## Root Cause Hypothesis

The tool handler builds a response object but does not guard against
`undefined` values before returning. When `getSignatureHelpItems()` returns
partial data or `null` for certain fields, `undefined` propagates into the
MCP response and fails schema validation.

## Suggested Fix

Add null/undefined guards in the signature_help handler before constructing
the MCP response. Ensure all required fields have fallback values (e.g.,
empty string for `text`).
