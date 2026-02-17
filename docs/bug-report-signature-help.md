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

## Retest (2026-02-17)

Retested after reported fix — **bug still present**.

Tested 6 function call positions across 3 files:

| File | Line | Col | Function | Result |
|------|------|-----|----------|--------|
| `src/app/api/chat/route.ts` | 38 | 32 | `request.json()` | FAIL -32602 |
| `src/app/api/chat/route.ts` | 45 | 10 | `NextResponse.json()` | FAIL |
| `src/app/api/skills/route.ts` | 66 | 29 | `NextResponse.json()` | FAIL -32602 |
| `scripts/crawl-skills.ts` | 210 | 51 | `fetchWithTimeout()` | FAIL |
| `scripts/crawl-skills.ts` | 212 | 24 | `cheerio.load()` | FAIL -32602 |
| `scripts/crawl-skills.ts` | 346 | 36 | `response.json()` | FAIL |

All 6 tests failed with the same MCP error -32602 (undefined `text` in response).
The error is identical to the original report — the fix did not resolve this issue.
