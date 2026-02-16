# ts-mcp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MCP server that gives AI agents IDE-level TypeScript code navigation, impact analysis, and JSDoc metadata.

**Architecture:** Three-layer design — MCP Layer (tool definitions, I/O) → TS Service Layer (Language Service wrapper, caching) → Project Layer (tsconfig, file management). TypeScript Language Service API is used directly (in-process, no LSP).

**Tech Stack:** Node.js, TypeScript, @modelcontextprotocol/sdk, typescript (Language Service API), tsup, Vitest, zod

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `src/index.ts` (placeholder)
- Create: `.gitignore`

**Step 1: Create project directory and initialize**

```bash
mkdir -p /Users/hyukho/Desktop/Workspace/ts-mcp
cd /Users/hyukho/Desktop/Workspace/ts-mcp
git init
```

**Step 2: Create package.json**

```json
{
  "name": "ts-mcp",
  "version": "0.1.0",
  "description": "TypeScript MCP server for symbol-based code navigation and impact analysis",
  "type": "module",
  "bin": {
    "ts-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "typescript": "^5.7.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  banner: {
    js: '#!/usr/bin/env node',
  },
})
```

**Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
```

**Step 7: Create placeholder entry point**

```typescript
// src/index.ts
console.log('ts-mcp')
```

**Step 8: Install dependencies and verify**

```bash
npm install
npx vitest run
```

Expected: 0 tests, no errors.

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold ts-mcp project"
```

---

### Task 2: Test Fixture — Sample TypeScript Project

**Files:**
- Create: `tests/fixtures/sample-project/tsconfig.json`
- Create: `tests/fixtures/sample-project/src/types.ts`
- Create: `tests/fixtures/sample-project/src/user-service.ts`
- Create: `tests/fixtures/sample-project/src/user-controller.ts`
- Create: `tests/fixtures/sample-project/src/index.ts`

A small but realistic TS project with interfaces, implementations, call chains, JSDoc, and @deprecated symbols. Used by all subsequent tests.

**Step 1: Create fixture tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 2: Create types.ts**

```typescript
/** User entity */
export interface User {
  id: string
  name: string
  email: string
}

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findAll(): Promise<User[]>
  save(user: User): Promise<void>
}

/**
 * @deprecated Use UserRepository instead
 * @see UserRepository
 */
export interface OldUserStore {
  getUser(id: string): Promise<User | null>
}

/**
 * @ts-mcp-caution Modifying this affects payment flow
 * @ts-mcp-owner backend-team
 */
export interface PaymentService {
  charge(userId: string, amount: number): Promise<boolean>
}
```

**Step 3: Create user-service.ts**

```typescript
import type { User, UserRepository } from './types'

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map()

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values())
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user)
  }
}

/**
 * @param repository - User data source
 * @returns User or throws if not found
 * @throws Error when user is not found
 */
export async function getUserOrThrow(
  repository: UserRepository,
  id: string,
): Promise<User> {
  const user = await repository.findById(id)
  if (!user) throw new Error(`User ${id} not found`)
  return user
}
```

**Step 4: Create user-controller.ts**

```typescript
import type { UserRepository } from './types'
import { getUserOrThrow } from './user-service'

export class UserController {
  constructor(private repo: UserRepository) {}

  async getUser(id: string) {
    return getUserOrThrow(this.repo, id)
  }

  async listUsers() {
    return this.repo.findAll()
  }
}
```

**Step 5: Create index.ts**

```typescript
export { UserController } from './user-controller'
export { InMemoryUserRepository, getUserOrThrow } from './user-service'
export type { User, UserRepository, PaymentService } from './types'
```

**Step 6: Commit**

```bash
git add tests/fixtures/
git commit -m "test: add sample TypeScript project fixture"
```

---

### Task 3: Project Layer — Config Loader & TS Resolution

**Files:**
- Create: `src/project/config-loader.ts`
- Create: `src/project/resolve-typescript.ts`
- Create: `tests/project/config-loader.test.ts`
- Create: `tests/project/resolve-typescript.test.ts`

**Step 1: Write the failing test for resolve-typescript**

```typescript
// tests/project/resolve-typescript.test.ts
import { describe, it, expect } from 'vitest'
import { resolveTypeScript } from '../../src/project/resolve-typescript'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')

describe('resolveTypeScript', () => {
  it('returns typescript module for a valid workspace', () => {
    const ts = resolveTypeScript(fixtureDir)
    expect(ts).toBeDefined()
    expect(typeof ts.createLanguageService).toBe('function')
  })

  it('falls back to bundled typescript for non-existent workspace', () => {
    const ts = resolveTypeScript('/non/existent/path')
    expect(ts).toBeDefined()
    expect(typeof ts.createLanguageService).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/project/resolve-typescript.test.ts`
Expected: FAIL — module not found

**Step 3: Implement resolve-typescript**

```typescript
// src/project/resolve-typescript.ts
import { createRequire } from 'node:module'
import type ts from 'typescript'

export function resolveTypeScript(workspace: string): typeof ts {
  try {
    const require = createRequire(workspace + '/package.json')
    return require('typescript')
  } catch {
    return require('typescript') as typeof ts
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/project/resolve-typescript.test.ts`
Expected: PASS

**Step 5: Write the failing test for config-loader**

```typescript
// tests/project/config-loader.test.ts
import { describe, it, expect } from 'vitest'
import { loadTsConfig } from '../../src/project/config-loader'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')

describe('loadTsConfig', () => {
  it('loads tsconfig.json and returns parsed config', () => {
    const config = loadTsConfig(fixtureDir)
    expect(config.options).toBeDefined()
    expect(config.options.strict).toBe(true)
    expect(config.fileNames.length).toBeGreaterThan(0)
  })

  it('includes all .ts files from the project', () => {
    const config = loadTsConfig(fixtureDir)
    const fileNames = config.fileNames.map(f => path.basename(f))
    expect(fileNames).toContain('types.ts')
    expect(fileNames).toContain('user-service.ts')
    expect(fileNames).toContain('user-controller.ts')
    expect(fileNames).toContain('index.ts')
  })
})
```

**Step 6: Run test to verify it fails**

Run: `npx vitest run tests/project/config-loader.test.ts`
Expected: FAIL — module not found

**Step 7: Implement config-loader**

```typescript
// src/project/config-loader.ts
import path from 'node:path'
import type ts from 'typescript'

export interface TsConfig {
  options: ts.CompilerOptions
  fileNames: string[]
  errors: ts.Diagnostic[]
}

export function loadTsConfig(
  workspace: string,
  tsModule?: typeof ts,
): TsConfig {
  const tsLib = tsModule ?? require('typescript')
  const configPath = tsLib.findConfigFile(
    workspace,
    tsLib.sys.fileExists,
    'tsconfig.json',
  )

  if (!configPath) {
    return {
      options: tsLib.getDefaultCompilerOptions(),
      fileNames: [],
      errors: [],
    }
  }

  const configFile = tsLib.readConfigFile(configPath, tsLib.sys.readFile)
  const parsed = tsLib.parseJsonConfigFileContent(
    configFile.config,
    tsLib.sys,
    path.dirname(configPath),
  )

  return {
    options: parsed.options,
    fileNames: parsed.fileNames,
    errors: parsed.errors,
  }
}
```

**Step 8: Run test to verify it passes**

Run: `npx vitest run tests/project/`
Expected: PASS

**Step 9: Commit**

```bash
git add src/project/ tests/project/
git commit -m "feat: add project layer — tsconfig loader and TS resolution"
```

---

### Task 4: TS Service Layer — Language Service Wrapper

**Files:**
- Create: `src/service/language-service.ts`
- Create: `src/service/position-utils.ts`
- Create: `tests/service/language-service.test.ts`

**Step 1: Write the failing test for position-utils**

```typescript
// tests/service/position-utils.test.ts
import { describe, it, expect } from 'vitest'
import { toOffset, toLineColumn } from '../../src/service/position-utils'

describe('position-utils', () => {
  const content = 'line1\nline2\nline3'

  it('converts line:column to offset', () => {
    expect(toOffset(content, 1, 1)).toBe(0)   // start of line1
    expect(toOffset(content, 2, 1)).toBe(6)   // start of line2
    expect(toOffset(content, 2, 3)).toBe(8)   // 'n' in line2
  })

  it('converts offset to line:column', () => {
    expect(toLineColumn(content, 0)).toEqual({ line: 1, column: 1 })
    expect(toLineColumn(content, 6)).toEqual({ line: 2, column: 1 })
    expect(toLineColumn(content, 8)).toEqual({ line: 2, column: 3 })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/service/position-utils.test.ts`
Expected: FAIL

**Step 3: Implement position-utils**

```typescript
// src/service/position-utils.ts
export function toOffset(content: string, line: number, column: number): number {
  const lines = content.split('\n')
  let offset = 0
  for (let i = 0; i < line - 1; i++) {
    offset += lines[i].length + 1
  }
  return offset + column - 1
}

export function toLineColumn(
  content: string,
  offset: number,
): { line: number; column: number } {
  const before = content.slice(0, offset)
  const line = before.split('\n').length
  const lastNewline = before.lastIndexOf('\n')
  const column = offset - lastNewline
  return { line, column }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/service/position-utils.test.ts`
Expected: PASS

**Step 5: Write the failing test for language-service**

```typescript
// tests/service/language-service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')

describe('TsMcpLanguageService', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('initializes with project files', () => {
    const files = svc.getProjectFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(f => f.endsWith('types.ts'))).toBe(true)
  })

  it('can read file content', () => {
    const typesFile = svc.getProjectFiles().find(f => f.endsWith('types.ts'))!
    const content = svc.getFileContent(typesFile)
    expect(content).toContain('interface User')
  })
})
```

**Step 6: Run test to verify it fails**

Run: `npx vitest run tests/service/language-service.test.ts`
Expected: FAIL — class not found

**Step 7: Implement language-service**

```typescript
// src/service/language-service.ts
import ts from 'typescript'
import path from 'node:path'
import { loadTsConfig } from '../project/config-loader'
import { resolveTypeScript } from '../project/resolve-typescript'

export class TsMcpLanguageService {
  private ts: typeof ts
  private service: ts.LanguageService
  private files: Map<string, { version: number; content: string }>

  constructor(private workspace: string) {
    this.ts = resolveTypeScript(workspace)
    this.files = new Map()

    const config = loadTsConfig(workspace, this.ts)

    for (const fileName of config.fileNames) {
      const content = this.ts.sys.readFile(fileName) ?? ''
      this.files.set(fileName, { version: 0, content })
    }

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => [...this.files.keys()],
      getScriptVersion: (fileName) =>
        String(this.files.get(fileName)?.version ?? 0),
      getScriptSnapshot: (fileName) => {
        const file = this.files.get(fileName)
        if (file) return this.ts.ScriptSnapshot.fromString(file.content)
        const content = this.ts.sys.readFile(fileName)
        if (content !== undefined)
          return this.ts.ScriptSnapshot.fromString(content)
        return undefined
      },
      getCurrentDirectory: () => workspace,
      getCompilationSettings: () => config.options,
      getDefaultLibFileName: (options) =>
        this.ts.getDefaultLibFilePath(options),
      fileExists: this.ts.sys.fileExists,
      readFile: this.ts.sys.readFile,
      readDirectory: this.ts.sys.readDirectory,
      directoryExists: this.ts.sys.directoryExists,
      getDirectories: this.ts.sys.getDirectories,
    }

    this.service = this.ts.createLanguageService(
      host,
      this.ts.createDocumentRegistry(),
    )
  }

  getProjectFiles(): string[] {
    return [...this.files.keys()]
  }

  getFileContent(fileName: string): string {
    return this.files.get(fileName)?.content ?? ''
  }

  getRawService(): ts.LanguageService {
    return this.service
  }

  getTs(): typeof ts {
    return this.ts
  }

  resolvePosition(fileName: string, line: number, column: number): number {
    const content = this.getFileContent(fileName)
    const lines = content.split('\n')
    let offset = 0
    for (let i = 0; i < line - 1; i++) {
      offset += lines[i].length + 1
    }
    return offset + column - 1
  }

  resolveFileName(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath
    return path.resolve(this.workspace, filePath)
  }

  dispose(): void {
    this.service.dispose()
  }
}
```

**Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/service/`
Expected: PASS

**Step 9: Commit**

```bash
git add src/service/ tests/service/
git commit -m "feat: add TS Service layer — Language Service wrapper and position utils"
```

---

### Task 5: MCP Server Skeleton

**Files:**
- Create: `src/server.ts`
- Modify: `src/index.ts`
- Create: `tests/server.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/server.test.ts
import { describe, it, expect } from 'vitest'
import { createTsMcpServer } from '../src/server'

describe('createTsMcpServer', () => {
  it('creates a server instance', () => {
    const server = createTsMcpServer('/tmp/fake-workspace')
    expect(server).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server.test.ts`
Expected: FAIL

**Step 3: Implement server.ts**

```typescript
// src/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TsMcpLanguageService } from './service/language-service'

export function createTsMcpServer(workspace: string) {
  const server = new McpServer({
    name: 'ts-mcp',
    version: '0.1.0',
  })

  const languageService = new TsMcpLanguageService(workspace)

  // Tools will be registered here by each tool module

  return { server, languageService }
}
```

**Step 4: Implement index.ts (CLI entry point)**

```typescript
// src/index.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTsMcpServer } from './server'

const args = process.argv.slice(2)
const workspaceIdx = args.indexOf('--workspace')
const workspace = workspaceIdx !== -1 ? args[workspaceIdx + 1] : process.cwd()

const { server } = createTsMcpServer(workspace)
const transport = new StdioServerTransport()
await server.connect(transport)
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/server.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/server.ts src/index.ts tests/server.test.ts
git commit -m "feat: add MCP server skeleton with stdio transport"
```

---

### Task 6: Navigation Tools — goto_definition & find_references

**Files:**
- Create: `src/tools/navigation.ts`
- Create: `tests/tools/navigation.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/tools/navigation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import {
  gotoDefinition,
  findReferences,
} from '../../src/tools/navigation'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const typesFile = path.join(fixtureDir, 'src/types.ts')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')
const controllerFile = path.join(fixtureDir, 'src/user-controller.ts')

describe('navigation tools', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  describe('gotoDefinition', () => {
    it('finds definition of UserRepository in user-service.ts', () => {
      // `import type { User, UserRepository } from './types'`
      // UserRepository is on line 1, find its column position
      const content = svc.getFileContent(serviceFile)
      const match = content.indexOf('UserRepository')
      const lines = content.slice(0, match).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = gotoDefinition(svc, serviceFile, line, column)
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].file).toContain('types.ts')
    })
  })

  describe('findReferences', () => {
    it('finds all references to getUserOrThrow', () => {
      const content = svc.getFileContent(serviceFile)
      const match = content.indexOf('getUserOrThrow')
      const lines = content.slice(0, match).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = findReferences(svc, serviceFile, line, column)
      // Should find: definition in user-service.ts, usage in user-controller.ts, export in index.ts
      expect(result.length).toBeGreaterThanOrEqual(2)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/navigation.test.ts`
Expected: FAIL

**Step 3: Implement navigation tools**

```typescript
// src/tools/navigation.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import { toLineColumn } from '../service/position-utils'

export interface DefinitionResult {
  file: string
  line: number
  column: number
  text: string
}

export interface ReferenceResult {
  file: string
  line: number
  column: number
  text: string
}

export function gotoDefinition(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): DefinitionResult[] {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const definitions = svc.getRawService().getDefinitionAtPosition(fileName, position)

  if (!definitions) return []

  return definitions.map((def) => {
    const content = svc.getFileContent(def.fileName) || svc.getTs().sys.readFile(def.fileName) || ''
    const loc = toLineColumn(content, def.textSpan.start)
    const text = content.slice(def.textSpan.start, def.textSpan.start + def.textSpan.length)
    return {
      file: def.fileName,
      line: loc.line,
      column: loc.column,
      text,
    }
  })
}

export function findReferences(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): ReferenceResult[] {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const refs = svc.getRawService().findReferences(fileName, position)

  if (!refs) return []

  const results: ReferenceResult[] = []
  for (const group of refs) {
    for (const ref of group.references) {
      const content = svc.getFileContent(ref.fileName) || svc.getTs().sys.readFile(ref.fileName) || ''
      const loc = toLineColumn(content, ref.textSpan.start)
      const text = content.slice(ref.textSpan.start, ref.textSpan.start + ref.textSpan.length)
      results.push({
        file: ref.fileName,
        line: loc.line,
        column: loc.column,
        text,
      })
    }
  }
  return results
}

export function registerNavigationTools(
  mcpServer: McpServer,
  svc: TsMcpLanguageService,
): void {
  mcpServer.tool(
    'goto_definition',
    'Find where a symbol is defined. Use instead of grep to navigate to source.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    async ({ file, line, column }) => {
      const results = gotoDefinition(svc, file, line, column)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2),
        }],
      }
    },
  )

  mcpServer.tool(
    'find_references',
    'Find all locations where a symbol is used. Use instead of grep for symbol search.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    async ({ file, line, column }) => {
      const results = findReferences(svc, file, line, column)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2),
        }],
      }
    },
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/navigation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/navigation.ts tests/tools/navigation.test.ts
git commit -m "feat: add goto_definition and find_references tools"
```

---

### Task 7: Navigation Tools — workspace_symbols & document_symbols

**Files:**
- Modify: `src/tools/navigation.ts`
- Modify: `tests/tools/navigation.test.ts`

**Step 1: Write the failing tests**

Add to `tests/tools/navigation.test.ts`:

```typescript
import {
  gotoDefinition,
  findReferences,
  workspaceSymbols,
  documentSymbols,
} from '../../src/tools/navigation'

describe('workspaceSymbols', () => {
  it('finds symbols matching a query', () => {
    const result = workspaceSymbols(svc, 'UserRepository')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].name).toContain('UserRepository')
  })

  it('returns empty for no match', () => {
    const result = workspaceSymbols(svc, 'NonExistentXYZ123')
    expect(result).toEqual([])
  })
})

describe('documentSymbols', () => {
  it('returns symbols in types.ts', () => {
    const result = documentSymbols(svc, typesFile)
    const names = result.map(s => s.name)
    expect(names).toContain('User')
    expect(names).toContain('UserRepository')
    expect(names).toContain('PaymentService')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/navigation.test.ts`
Expected: FAIL — functions not exported

**Step 3: Implement workspace_symbols and document_symbols**

Add to `src/tools/navigation.ts`:

```typescript
export interface SymbolResult {
  name: string
  kind: string
  file: string
  line: number
  column: number
}

export function workspaceSymbols(
  svc: TsMcpLanguageService,
  query: string,
): SymbolResult[] {
  const ts = svc.getTs()
  const items = svc.getRawService().getNavigateToItems(query)
  return items.map((item) => {
    const content = svc.getFileContent(item.fileName) || ts.sys.readFile(item.fileName) || ''
    const loc = toLineColumn(content, item.textSpan.start)
    return {
      name: item.name,
      kind: ts.ScriptElementKind[item.kind] ?? item.kind,
      file: item.fileName,
      line: loc.line,
      column: loc.column,
    }
  })
}

export function documentSymbols(
  svc: TsMcpLanguageService,
  file: string,
): SymbolResult[] {
  const ts = svc.getTs()
  const fileName = svc.resolveFileName(file)
  const items = svc.getRawService().getNavigationBarItems(fileName)
  const content = svc.getFileContent(fileName)
  const results: SymbolResult[] = []

  function flatten(items: ts.NavigationBarItem[]) {
    for (const item of items) {
      if (item.text === '<global>') {
        flatten(item.childItems)
        continue
      }
      const loc = toLineColumn(content, item.spans[0].start)
      results.push({
        name: item.text,
        kind: item.kind,
        file: fileName,
        line: loc.line,
        column: loc.column,
      })
      if (item.childItems) flatten(item.childItems)
    }
  }

  flatten(items)
  return results
}
```

Also register MCP tools for these in `registerNavigationTools`:

```typescript
mcpServer.tool(
  'workspace_symbols',
  'Search for symbols across the entire project by name.',
  {
    query: z.string().describe('Symbol name or pattern to search'),
  },
  async ({ query }) => {
    const results = workspaceSymbols(svc, query)
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    }
  },
)

mcpServer.tool(
  'document_symbols',
  'List all symbols in a file (outline). Understand file structure without reading it.',
  {
    file: z.string().describe('Absolute or workspace-relative file path'),
  },
  async ({ file }) => {
    const results = documentSymbols(svc, file)
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    }
  },
)
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/navigation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/navigation.ts tests/tools/navigation.test.ts
git commit -m "feat: add workspace_symbols and document_symbols tools"
```

---

### Task 8: Impact Analysis — call_hierarchy

**Files:**
- Create: `src/tools/impact.ts`
- Create: `tests/tools/impact.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/tools/impact.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { callHierarchy } from '../../src/tools/impact'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')

describe('callHierarchy', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('finds incoming calls to getUserOrThrow', () => {
    const content = svc.getFileContent(serviceFile)
    const fnIndex = content.indexOf('async function getUserOrThrow')
    const fnNameIndex = content.indexOf('getUserOrThrow', fnIndex)
    const lines = content.slice(0, fnNameIndex).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = callHierarchy(svc, serviceFile, line, column, 'incoming')
    // UserController.getUser calls getUserOrThrow
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some(r => r.from.includes('getUser') || r.fromFile.includes('user-controller'))).toBe(true)
  })

  it('finds outgoing calls from getUserOrThrow', () => {
    const content = svc.getFileContent(serviceFile)
    const fnIndex = content.indexOf('async function getUserOrThrow')
    const fnNameIndex = content.indexOf('getUserOrThrow', fnIndex)
    const lines = content.slice(0, fnNameIndex).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = callHierarchy(svc, serviceFile, line, column, 'outgoing')
    // getUserOrThrow calls repository.findById
    expect(result.length).toBeGreaterThanOrEqual(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/impact.test.ts`
Expected: FAIL

**Step 3: Implement call_hierarchy**

```typescript
// src/tools/impact.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import { toLineColumn } from '../service/position-utils'

export interface CallHierarchyResult {
  from: string
  fromFile: string
  line: number
  column: number
}

export function callHierarchy(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
  direction: 'incoming' | 'outgoing',
): CallHierarchyResult[] {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const service = svc.getRawService()

  const prepared = service.prepareCallHierarchy(fileName, position)
  if (!prepared) return []

  const items = Array.isArray(prepared) ? prepared : [prepared]
  const results: CallHierarchyResult[] = []

  for (const item of items) {
    const calls =
      direction === 'incoming'
        ? service.provideCallHierarchyIncomingCalls(item.file, item.selectionSpan.start)
        : service.provideCallHierarchyOutgoingCalls(item.file, item.selectionSpan.start)

    for (const call of calls) {
      if (direction === 'incoming') {
        const incoming = call as import('typescript').CallHierarchyIncomingCall
        const content = svc.getFileContent(incoming.from.file) || svc.getTs().sys.readFile(incoming.from.file) || ''
        const loc = toLineColumn(content, incoming.from.selectionSpan.start)
        results.push({
          from: incoming.from.name,
          fromFile: incoming.from.file,
          line: loc.line,
          column: loc.column,
        })
      } else {
        const outgoing = call as import('typescript').CallHierarchyOutgoingCall
        const content = svc.getFileContent(outgoing.to.file) || svc.getTs().sys.readFile(outgoing.to.file) || ''
        const loc = toLineColumn(content, outgoing.to.selectionSpan.start)
        results.push({
          from: outgoing.to.name,
          fromFile: outgoing.to.file,
          line: loc.line,
          column: loc.column,
        })
      }
    }
  }

  return results
}

export function registerImpactTools(
  mcpServer: McpServer,
  svc: TsMcpLanguageService,
): void {
  mcpServer.tool(
    'call_hierarchy',
    'Find incoming or outgoing calls for a function. Shows who calls this function (incoming) or what this function calls (outgoing).',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
      direction: z.enum(['incoming', 'outgoing']).describe('Call direction'),
    },
    async ({ file, line, column, direction }) => {
      const results = callHierarchy(svc, file, line, column, direction)
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      }
    },
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/impact.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/impact.ts tests/tools/impact.test.ts
git commit -m "feat: add call_hierarchy tool"
```

---

### Task 9: Impact Analysis — type_hierarchy

**Files:**
- Modify: `src/tools/impact.ts`
- Modify: `tests/tools/impact.test.ts`

**Step 1: Write the failing test**

Add to `tests/tools/impact.test.ts`:

```typescript
import { callHierarchy, typeHierarchy } from '../../src/tools/impact'

const typesFile = path.join(fixtureDir, 'src/types.ts')

describe('typeHierarchy', () => {
  it('finds implementations of UserRepository', () => {
    const content = svc.getFileContent(typesFile)
    const match = content.indexOf('interface UserRepository')
    const nameIdx = content.indexOf('UserRepository', match)
    const lines = content.slice(0, nameIdx).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = typeHierarchy(svc, typesFile, line, column)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some(r => r.name.includes('InMemoryUserRepository'))).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/impact.test.ts`
Expected: FAIL

**Step 3: Implement type_hierarchy**

Add to `src/tools/impact.ts`:

```typescript
export interface TypeHierarchyResult {
  name: string
  file: string
  line: number
  column: number
  kind: string
}

export function typeHierarchy(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): TypeHierarchyResult[] {
  const ts = svc.getTs()
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const implementations = svc.getRawService().getImplementationAtPosition(fileName, position)

  if (!implementations) return []

  return implementations.map((impl) => {
    const content = svc.getFileContent(impl.fileName) || ts.sys.readFile(impl.fileName) || ''
    const loc = toLineColumn(content, impl.textSpan.start)
    const text = content.slice(impl.textSpan.start, impl.textSpan.start + impl.textSpan.length)
    return {
      name: text,
      file: impl.fileName,
      line: loc.line,
      column: loc.column,
      kind: impl.kind,
    }
  })
}
```

Register MCP tool in `registerImpactTools`:

```typescript
mcpServer.tool(
  'type_hierarchy',
  'Find all implementations of an interface or subtypes of a class.',
  {
    file: z.string().describe('Absolute or workspace-relative file path'),
    line: z.number().describe('1-based line number'),
    column: z.number().describe('1-based column number'),
  },
  async ({ file, line, column }) => {
    const results = typeHierarchy(svc, file, line, column)
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    }
  },
)
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/impact.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/impact.ts tests/tools/impact.test.ts
git commit -m "feat: add type_hierarchy tool"
```

---

### Task 10: Impact Analysis — impact_analysis (composite)

**Files:**
- Modify: `src/tools/impact.ts`
- Create: `src/service/impact-analyzer.ts`
- Create: `tests/service/impact-analyzer.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/service/impact-analyzer.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { analyzeImpact } from '../../src/service/impact-analyzer'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')

describe('analyzeImpact', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('calculates blast radius for getUserOrThrow', () => {
    const content = svc.getFileContent(serviceFile)
    const fnIndex = content.indexOf('async function getUserOrThrow')
    const nameIdx = content.indexOf('getUserOrThrow', fnIndex)
    const lines = content.slice(0, nameIdx).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = analyzeImpact(svc, serviceFile, line, column)

    expect(result.symbol).toBe('getUserOrThrow')
    expect(result.directReferences).toBeGreaterThanOrEqual(2)
    expect(result.affectedFiles.length).toBeGreaterThanOrEqual(2)
    expect(result.callers.length).toBeGreaterThanOrEqual(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/service/impact-analyzer.test.ts`
Expected: FAIL

**Step 3: Implement impact-analyzer**

```typescript
// src/service/impact-analyzer.ts
import type { TsMcpLanguageService } from './language-service'
import { findReferences } from '../tools/navigation'
import { callHierarchy, typeHierarchy } from '../tools/impact'
import { toLineColumn } from './position-utils'

export interface ImpactResult {
  symbol: string
  file: string
  line: number
  column: number
  directReferences: number
  affectedFiles: string[]
  callers: Array<{ name: string; file: string; line: number }>
  implementations: Array<{ name: string; file: string; line: number }>
  risk: 'low' | 'medium' | 'high'
}

export function analyzeImpact(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): ImpactResult {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)

  // Get symbol name
  const quickInfo = svc.getRawService().getQuickInfoAtPosition(fileName, position)
  const symbolName = quickInfo?.displayParts?.map(p => p.text).join('').split('(')[0].split(':')[0].trim() ?? 'unknown'

  // References
  const refs = findReferences(svc, file, line, column)
  const affectedFiles = [...new Set(refs.map(r => r.file))]

  // Call hierarchy
  const callers = callHierarchy(svc, file, line, column, 'incoming')

  // Type hierarchy
  const impls = typeHierarchy(svc, file, line, column)

  // Risk calculation
  const totalImpact = refs.length + callers.length + impls.length
  const risk: ImpactResult['risk'] =
    totalImpact >= 20 ? 'high' :
    totalImpact >= 5 ? 'medium' :
    'low'

  return {
    symbol: symbolName,
    file: fileName,
    line,
    column,
    directReferences: refs.length,
    affectedFiles,
    callers: callers.map(c => ({ name: c.from, file: c.fromFile, line: c.line })),
    implementations: impls.map(i => ({ name: i.name, file: i.file, line: i.line })),
    risk,
  }
}
```

Register in `src/tools/impact.ts`:

```typescript
import { analyzeImpact } from '../service/impact-analyzer'

// Inside registerImpactTools:
mcpServer.tool(
  'impact_analysis',
  'Analyze blast radius before modifying a symbol. Shows all references, callers, implementations, and risk level.',
  {
    file: z.string().describe('Absolute or workspace-relative file path'),
    line: z.number().describe('1-based line number'),
    column: z.number().describe('1-based column number'),
  },
  async ({ file, line, column }) => {
    const result = analyzeImpact(svc, file, line, column)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/service/impact-analyzer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/service/impact-analyzer.ts src/tools/impact.ts tests/service/impact-analyzer.test.ts
git commit -m "feat: add impact_analysis composite tool"
```

---

### Task 11: Code Intelligence — signature_help & get_type_info

**Files:**
- Create: `src/tools/intelligence.ts`
- Create: `tests/tools/intelligence.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/tools/intelligence.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { signatureHelp, getTypeInfo } from '../../src/tools/intelligence'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')
const typesFile = path.join(fixtureDir, 'src/types.ts')

describe('intelligence tools', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  describe('getTypeInfo', () => {
    it('returns type info for User interface', () => {
      const content = svc.getFileContent(typesFile)
      const match = content.indexOf('interface User {')
      const nameIdx = content.indexOf('User', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = getTypeInfo(svc, typesFile, line, column)
      expect(result).toBeDefined()
      expect(result!.displayString).toContain('User')
    })

    it('detects @deprecated on OldUserStore', () => {
      const content = svc.getFileContent(typesFile)
      const match = content.indexOf('interface OldUserStore')
      const nameIdx = content.indexOf('OldUserStore', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = getTypeInfo(svc, typesFile, line, column)
      expect(result).toBeDefined()
      expect(result!.jsdoc?.deprecated).toBeDefined()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/intelligence.test.ts`
Expected: FAIL

**Step 3: Implement intelligence tools**

```typescript
// src/tools/intelligence.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import { extractJsDoc } from '../service/jsdoc-parser'

export interface TypeInfoResult {
  displayString: string
  documentation: string
  kind: string
  jsdoc?: Record<string, any>
}

export interface SignatureHelpResult {
  signatures: Array<{
    label: string
    documentation: string
    parameters: Array<{ name: string; documentation: string }>
  }>
  activeSignature: number
  activeParameter: number
}

export function getTypeInfo(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): TypeInfoResult | undefined {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const info = svc.getRawService().getQuickInfoAtPosition(fileName, position)

  if (!info) return undefined

  const displayString = info.displayParts?.map(p => p.text).join('') ?? ''
  const documentation = info.documentation?.map(d => d.text).join('\n') ?? ''

  const jsdoc = info.tags ? extractJsDoc(info.tags) : undefined

  return {
    displayString,
    documentation,
    kind: info.kind,
    jsdoc,
  }
}

export function signatureHelp(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): SignatureHelpResult | undefined {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const help = svc.getRawService().getSignatureHelpItems(fileName, position, undefined)

  if (!help) return undefined

  return {
    signatures: help.items.map((item) => ({
      label: [...item.prefixDisplayParts, ...item.separatorDisplayParts, ...item.suffixDisplayParts]
        .map(p => p.text).join(''),
      documentation: item.documentation.map(d => d.text).join('\n'),
      parameters: item.parameters.map((p) => ({
        name: p.displayParts.map(d => d.text).join(''),
        documentation: p.documentation.map(d => d.text).join('\n'),
      })),
    })),
    activeSignature: help.selectedItemIndex,
    activeParameter: help.argumentIndex,
  }
}

export function registerIntelligenceTools(
  mcpServer: McpServer,
  svc: TsMcpLanguageService,
): void {
  mcpServer.tool(
    'get_type_info',
    'Get type information, documentation, and JSDoc metadata for a symbol.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    async ({ file, line, column }) => {
      const result = getTypeInfo(svc, file, line, column)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  mcpServer.tool(
    'signature_help',
    'Get function signature, parameter info, and overloads at a call site.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    async ({ file, line, column }) => {
      const result = signatureHelp(svc, file, line, column)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/intelligence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/intelligence.ts tests/tools/intelligence.test.ts
git commit -m "feat: add get_type_info and signature_help tools"
```

---

### Task 12: JSDoc/TSDoc Parser

**Files:**
- Create: `src/service/jsdoc-parser.ts`
- Create: `tests/service/jsdoc-parser.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/service/jsdoc-parser.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { extractJsDocFromNode } from '../../src/service/jsdoc-parser'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const typesFile = path.join(fixtureDir, 'src/types.ts')

describe('jsdoc-parser', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('extracts @deprecated tag', () => {
    const content = svc.getFileContent(typesFile)
    const position = svc.resolvePosition(
      typesFile,
      findLine(content, 'interface OldUserStore'),
      content.indexOf('OldUserStore', content.indexOf('interface OldUserStore')) -
        content.lastIndexOf('\n', content.indexOf('interface OldUserStore')),
    )
    const info = svc.getRawService().getQuickInfoAtPosition(typesFile, position)
    expect(info?.tags?.some(t => t.name === 'deprecated')).toBe(true)
  })

  it('extracts custom @ts-mcp- tags', () => {
    const content = svc.getFileContent(typesFile)
    const position = svc.resolvePosition(
      typesFile,
      findLine(content, 'interface PaymentService'),
      content.indexOf('PaymentService', content.indexOf('interface PaymentService')) -
        content.lastIndexOf('\n', content.indexOf('interface PaymentService')),
    )
    const info = svc.getRawService().getQuickInfoAtPosition(typesFile, position)
    // TS compiler treats custom tags as regular JSDoc tags
    expect(info?.tags?.some(t => t.name === 'ts-mcp-caution')).toBe(true)
  })
})

function findLine(content: string, text: string): number {
  const idx = content.indexOf(text)
  return content.slice(0, idx).split('\n').length
}
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/service/jsdoc-parser.test.ts`
Expected: FAIL

**Step 3: Implement jsdoc-parser**

```typescript
// src/service/jsdoc-parser.ts
import type ts from 'typescript'

export interface JsDocInfo {
  deprecated?: { message: string }
  params?: Array<{ name: string; description: string }>
  returns?: string
  throws?: string[]
  see?: string[]
  examples?: string[]
  customTags?: Record<string, string>
}

const TS_MCP_PREFIX = 'ts-mcp-'

export function extractJsDoc(tags: ts.JSDocTagInfo[]): JsDocInfo | undefined {
  if (!tags || tags.length === 0) return undefined

  const result: JsDocInfo = {}
  const customTags: Record<string, string> = {}

  for (const tag of tags) {
    const text = tag.text?.map(t => t.text).join('') ?? ''

    if (tag.name === 'deprecated') {
      result.deprecated = { message: text }
    } else if (tag.name === 'param') {
      result.params ??= []
      result.params.push({ name: '', description: text })
    } else if (tag.name === 'returns' || tag.name === 'return') {
      result.returns = text
    } else if (tag.name === 'throws' || tag.name === 'throw') {
      result.throws ??= []
      result.throws.push(text)
    } else if (tag.name === 'see') {
      result.see ??= []
      result.see.push(text)
    } else if (tag.name === 'example') {
      result.examples ??= []
      result.examples.push(text)
    } else if (tag.name.startsWith(TS_MCP_PREFIX)) {
      const key = tag.name.slice(TS_MCP_PREFIX.length)
      customTags[key] = text
    }
  }

  if (Object.keys(customTags).length > 0) {
    result.customTags = customTags
  }

  return Object.keys(result).length > 0 ? result : undefined
}

export function extractJsDocFromNode(
  node: ts.Node,
  tsModule: typeof import('typescript'),
): JsDocInfo | undefined {
  const tags = tsModule.getJSDocTags(node)
  if (!tags || tags.length === 0) return undefined

  const result: JsDocInfo = {}
  const customTags: Record<string, string> = {}

  for (const tag of tags) {
    const tagName = tag.tagName.text
    const comment =
      typeof tag.comment === 'string'
        ? tag.comment
        : tag.comment?.map(c => c.text).join('') ?? ''

    if (tagName === 'deprecated') {
      result.deprecated = { message: comment }
    } else if (tagName.startsWith(TS_MCP_PREFIX)) {
      const key = tagName.slice(TS_MCP_PREFIX.length)
      customTags[key] = comment
    }
  }

  if (Object.keys(customTags).length > 0) {
    result.customTags = customTags
  }

  return Object.keys(result).length > 0 ? result : undefined
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/service/jsdoc-parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/service/jsdoc-parser.ts tests/service/jsdoc-parser.test.ts
git commit -m "feat: add JSDoc/TSDoc parser with custom tag support"
```

---

### Task 13: Code Intelligence — rename_symbol

**Files:**
- Modify: `src/tools/intelligence.ts`
- Modify: `tests/tools/intelligence.test.ts`

**Step 1: Write the failing test**

Add to `tests/tools/intelligence.test.ts`:

```typescript
import { signatureHelp, getTypeInfo, renameSymbol } from '../../src/tools/intelligence'

describe('renameSymbol', () => {
  it('finds all rename locations for getUserOrThrow', () => {
    const content = svc.getFileContent(serviceFile)
    const fnIndex = content.indexOf('async function getUserOrThrow')
    const nameIdx = content.indexOf('getUserOrThrow', fnIndex)
    const lines = content.slice(0, nameIdx).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = renameSymbol(svc, serviceFile, line, column, 'getRequiredUser')
    expect(result.locations.length).toBeGreaterThanOrEqual(2)
    expect(result.locations.some(l => l.file.includes('user-controller'))).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/intelligence.test.ts`
Expected: FAIL

**Step 3: Implement rename_symbol**

Add to `src/tools/intelligence.ts`:

```typescript
export interface RenameResult {
  oldName: string
  newName: string
  locations: Array<{
    file: string
    line: number
    column: number
    text: string
  }>
}

export function renameSymbol(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
  newName: string,
): RenameResult {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const renameLocations = svc.getRawService().findRenameLocations(
    fileName,
    position,
    false,
    false,
  )

  const content = svc.getFileContent(fileName)
  const oldName = content.slice(position, position + (renameLocations?.[0]?.textSpan.length ?? 0))

  if (!renameLocations) {
    return { oldName, newName, locations: [] }
  }

  return {
    oldName,
    newName,
    locations: renameLocations.map((loc) => {
      const fileContent = svc.getFileContent(loc.fileName) || svc.getTs().sys.readFile(loc.fileName) || ''
      const locPos = toLineColumn(fileContent, loc.textSpan.start)
      const text = fileContent.slice(loc.textSpan.start, loc.textSpan.start + loc.textSpan.length)
      return {
        file: loc.fileName,
        line: locPos.line,
        column: locPos.column,
        text,
      }
    }),
  }
}
```

Add `toLineColumn` import and register MCP tool:

```typescript
mcpServer.tool(
  'rename_symbol',
  'Find all locations that need to change when renaming a symbol. Safer than find-and-replace.',
  {
    file: z.string().describe('Absolute or workspace-relative file path'),
    line: z.number().describe('1-based line number'),
    column: z.number().describe('1-based column number'),
    newName: z.string().describe('New name for the symbol'),
  },
  async ({ file, line, column, newName }) => {
    const result = renameSymbol(svc, file, line, column, newName)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/intelligence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/intelligence.ts tests/tools/intelligence.test.ts
git commit -m "feat: add rename_symbol tool"
```

---

### Task 14: Diagnostics Tool

**Files:**
- Create: `src/tools/diagnostics.ts`
- Create: `tests/tools/diagnostics.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/tools/diagnostics.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { getDiagnostics } from '../../src/tools/diagnostics'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const typesFile = path.join(fixtureDir, 'src/types.ts')

describe('diagnostics', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('returns no errors for valid files', () => {
    const result = getDiagnostics(svc, typesFile)
    const errors = result.filter(d => d.severity === 'error')
    expect(errors).toEqual([])
  })

  it('returns diagnostics for all files when no file specified', () => {
    const result = getDiagnostics(svc)
    expect(result).toBeDefined()
    // Valid fixture should have no errors
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/diagnostics.test.ts`
Expected: FAIL

**Step 3: Implement diagnostics**

```typescript
// src/tools/diagnostics.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import { toLineColumn } from '../service/position-utils'

export interface DiagnosticResult {
  file: string
  line: number
  column: number
  message: string
  code: number | undefined
  severity: 'error' | 'warning' | 'suggestion'
}

export function getDiagnostics(
  svc: TsMcpLanguageService,
  file?: string,
): DiagnosticResult[] {
  const ts = svc.getTs()
  const service = svc.getRawService()
  const files = file ? [svc.resolveFileName(file)] : svc.getProjectFiles()
  const results: DiagnosticResult[] = []

  for (const fileName of files) {
    const content = svc.getFileContent(fileName) || ts.sys.readFile(fileName) || ''
    const syntactic = service.getSyntacticDiagnostics(fileName)
    const semantic = service.getSemanticDiagnostics(fileName)
    const suggestions = service.getSuggestionDiagnostics(fileName)

    const mapDiag = (
      diag: import('typescript').Diagnostic,
      severity: DiagnosticResult['severity'],
    ): DiagnosticResult | undefined => {
      if (diag.start === undefined) return undefined
      const loc = toLineColumn(content, diag.start)
      return {
        file: fileName,
        line: loc.line,
        column: loc.column,
        message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
        code: diag.code,
        severity,
      }
    }

    for (const d of syntactic) {
      const r = mapDiag(d, 'error')
      if (r) results.push(r)
    }
    for (const d of semantic) {
      const severity = d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning'
      const r = mapDiag(d, severity)
      if (r) results.push(r)
    }
    for (const d of suggestions) {
      const r = mapDiag(d, 'suggestion')
      if (r) results.push(r)
    }
  }

  return results
}

export function registerDiagnosticsTools(
  mcpServer: McpServer,
  svc: TsMcpLanguageService,
): void {
  mcpServer.tool(
    'diagnostics',
    'Get TypeScript errors and warnings without running tsc. Works on a single file or entire project.',
    {
      file: z.string().optional().describe('File path (omit for all files)'),
    },
    async ({ file }) => {
      const results = getDiagnostics(svc, file)
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      }
    },
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/diagnostics.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/diagnostics.ts tests/tools/diagnostics.test.ts
git commit -m "feat: add diagnostics tool"
```

---

### Task 15: Wire Everything Together

**Files:**
- Modify: `src/server.ts`
- Create: `tests/integration.test.ts`

**Step 1: Write the integration test**

```typescript
// tests/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTsMcpServer } from '../src/server'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, 'fixtures/sample-project')

describe('ts-mcp integration', () => {
  let instance: ReturnType<typeof createTsMcpServer>

  beforeAll(() => {
    instance = createTsMcpServer(fixtureDir)
  })

  afterAll(() => {
    instance.languageService.dispose()
  })

  it('creates server with all tools registered', () => {
    expect(instance.server).toBeDefined()
    expect(instance.languageService).toBeDefined()
  })

  it('language service can find definitions', () => {
    const files = instance.languageService.getProjectFiles()
    expect(files.length).toBe(4)
  })
})
```

**Step 2: Update server.ts to wire all tools**

```typescript
// src/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TsMcpLanguageService } from './service/language-service'
import { registerNavigationTools } from './tools/navigation'
import { registerImpactTools } from './tools/impact'
import { registerIntelligenceTools } from './tools/intelligence'
import { registerDiagnosticsTools } from './tools/diagnostics'

export function createTsMcpServer(workspace: string) {
  const server = new McpServer({
    name: 'ts-mcp',
    version: '0.1.0',
  })

  const languageService = new TsMcpLanguageService(workspace)

  registerNavigationTools(server, languageService)
  registerImpactTools(server, languageService)
  registerIntelligenceTools(server, languageService)
  registerDiagnosticsTools(server, languageService)

  return { server, languageService }
}
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Build and verify**

```bash
npx tsup
ls dist/index.js
```

Expected: `dist/index.js` exists with shebang

**Step 5: Commit**

```bash
git add src/server.ts tests/integration.test.ts
git commit -m "feat: wire all tools and add integration test"
```

---

### Task 16: README and Final Cleanup

**Files:**
- Create: `README.md`
- Verify: all tests pass, build succeeds

**Step 1: Create README.md**

```markdown
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
```

**Step 2: Run full verification**

```bash
npx vitest run
npx tsup
```

Expected: All tests pass, build succeeds.

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Execution Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | package.json, tsconfig, tsup, vitest |
| 2 | Test fixture | tests/fixtures/sample-project/ |
| 3 | Project Layer | config-loader, resolve-typescript |
| 4 | TS Service Layer | language-service, position-utils |
| 5 | MCP Server skeleton | server.ts, index.ts |
| 6 | Navigation: definition + references | tools/navigation.ts |
| 7 | Navigation: symbols | tools/navigation.ts |
| 8 | Impact: call hierarchy | tools/impact.ts |
| 9 | Impact: type hierarchy | tools/impact.ts |
| 10 | Impact: blast radius | service/impact-analyzer.ts |
| 11 | Intelligence: type info + signature | tools/intelligence.ts |
| 12 | JSDoc/TSDoc parser | service/jsdoc-parser.ts |
| 13 | Intelligence: rename | tools/intelligence.ts |
| 14 | Diagnostics | tools/diagnostics.ts |
| 15 | Wire everything | server.ts, integration test |
| 16 | README + cleanup | README.md |
