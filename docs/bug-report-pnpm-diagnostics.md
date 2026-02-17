# Bug Report: diagnostics fails on pnpm projects

## Summary

`diagnostics` reports false "Cannot find module" errors for all npm packages
in pnpm-managed projects. `tsc --noEmit` runs clean on the same project.

## Environment

- **Project**: Next.js 14 + React 18 + Prisma + SASS (pnpm)
- **ts-mcp**: v0.2.0-beta.1 (globally linked via pnpm)
- **TypeScript**: 5.9.3 (same version in both project and ts-mcp)
- **Node**: v24.13.1
- **pnpm**: v10.29.3
- **OS**: macOS Darwin 25.2.0

## Symptoms

All `src/` files report "Cannot find module" for external packages:

```
Cannot find module 'next/server' or its corresponding type declarations.
Cannot find module '@prisma/client' or its corresponding type declarations.
Cannot find module 'zod' or its corresponding type declarations.
Cannot find module 'cheerio' or its corresponding type declarations.
JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
```

Files with only local imports (e.g., `src/types/index.ts`) report zero errors.

## What Works

- `tsc --noEmit` — zero errors
- `ts.resolveModuleName('next/server', ...)` with `ts.sys` — resolves correctly
- Navigation tools (`document_symbols`, `workspace_symbols`, `goto_definition`) — work fine on local code
- Standalone CJS test script reproducing the exact same `LanguageServiceHost` setup — zero errors

## Investigation Steps

### 1. Initial hypothesis: startup order (WRONG)

Thought ts-mcp initialized before `pnpm install`. Restarted session after
install — same errors. Disproved.

### 2. Added `realpath` to LanguageServiceHost (PARTIAL)

pnpm uses symlinks: `node_modules/next -> .pnpm/next@.../node_modules/next`.
Added `realpath: this.ts.sys.realpath` to the host config.

Result: no change in diagnostics output. But this is likely still a correct
fix — it just wasn't the root cause.

### 3. Debug logging in language-service.ts constructor

Added `console.error` logging to trace runtime behavior. Key findings:

```
[ts-mcp DEBUG] workspace: /Users/hyukho/.../agent-builder/scripts    ← SERVICE 1
[ts-mcp DEBUG] TS version: 5.9.3
[ts-mcp DEBUG] moduleResolution: 100 (bundler)
[ts-mcp DEBUG] fileNames count: 2
[ts-mcp DEBUG] next/server resolved: .../node_modules/.pnpm/next@14.2.23_.../next/server.d.ts  ← SUCCESS

[ts-mcp DEBUG] workspace: /Users/hyukho/.../agent-builder             ← SERVICE 2
[ts-mcp DEBUG] TS version: 5.9.3
[ts-mcp DEBUG] moduleResolution: 100 (bundler)
[ts-mcp DEBUG] fileNames count: 15
[ts-mcp DEBUG] next/server resolved: .../node_modules/.pnpm/next@14.2.23_.../next/server.d.ts  ← SUCCESS
```

**Two Language Services are created** because `discoverTsConfigs` finds 2 tsconfig.json files:
1. `/agent-builder/scripts/tsconfig.json` (2 files)
2. `/agent-builder/tsconfig.json` (15 files)

**Module resolution succeeds** in both services (`ts.resolveModuleName` with `ts.sys`).

### 4. CJS reproduction script — zero errors

```js
// Exact same host setup as ts-mcp
const host = {
  getScriptFileNames: () => [...files.keys()],
  getScriptVersion: ...,
  getScriptSnapshot: ...,
  getCurrentDirectory: () => workspace,
  getCompilationSettings: () => config.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
  realpath: ts.sys.realpath,
};

const service = ts.createLanguageService(host, ts.createDocumentRegistry());
service.getSemanticDiagnostics('src/lib/schemas.ts')  // → 0 errors
service.getSemanticDiagnostics('src/app/api/chat/route.ts')  // → 0 errors
```

## Unsolved Gap

The exact same `LanguageServiceHost` config produces:
- **0 errors** when run from a standalone CJS Node.js script
- **Many errors** when run from ts-mcp's ESM bundled binary (`dist/index.js`)

### Remaining hypotheses to investigate

1. **ESM vs CJS context**: ts-mcp runs as ESM (`"type": "module"`, tsup `format: ['esm']`).
   TypeScript's `sys` may behave differently in ESM context (unlikely but untested).

2. **MultiServiceProvider interaction**: Two services share the same `ts.sys` singleton.
   The scripts service may poison some internal TypeScript cache that affects the
   main service's module resolution inside the Language Service.

3. **`getDefaultLibFileName` path**: `ts.getDefaultLibFilePath(options)` may return
   a path relative to ts-mcp's bundled TypeScript rather than the project's TypeScript,
   causing missing lib definitions that cascade into JSX/module errors.

4. **TypeScript loaded from ts-mcp's own node_modules**: Despite `resolveTypeScript`
   attempting workspace-first resolution, the bundled ESM context may resolve to
   ts-mcp's own `node_modules/typescript` instead. This would cause
   `getDefaultLibFilePath` to point to wrong lib files.

### 5. Added explicit `resolveModuleNames` to host (NO EFFECT)

Added `resolveModuleNames` that calls `ts.resolveModuleName` with `ts.sys` directly:

```typescript
resolveModuleNames: (moduleNames, containingFile) => {
  return moduleNames.map((name) => {
    const result = this.ts.resolveModuleName(
      name, containingFile, config.options, this.ts.sys,
    )
    return result.resolvedModule
  })
},
```

Result: same errors. This definitively rules out module resolution as the cause.
The Language Service resolves modules correctly but something else prevents it
from loading/using the resolved type declarations.

## Suggested Next Steps

1. **Verify `getDefaultLibFilePath`**: `ts.getDefaultLibFilePath(options)` may point
   to ts-mcp's own TS libs instead of the project's. This would explain why React
   types, JSX intrinsics, and all `@types/*` fail — they depend on correct lib files.
2. **Test CJS build format**: Change tsup `format: ['cjs']` to rule out ESM context.
3. **Test SingleServiceProvider only**: Skip scripts/ tsconfig to rule out multi-service.
4. **Compare `getDefaultLibFileName` output**: Between the working CJS script and
   ts-mcp's ESM binary — if paths differ, that's the root cause.

## Files Changed

- `src/service/language-service.ts` — added `realpath`, `resolveModuleNames` to host
