import type ts from 'typescript'
import path from 'node:path'
import { loadTsConfig } from '../project/config-loader'
import { resolveTypeScript } from '../project/resolve-typescript'
import { SymbolIndexer } from './symbol-indexer'

export class TsMcpLanguageService {
  private ts: typeof ts
  private service: ts.LanguageService
  private files: Map<string, { version: number; content: string }>
  private symbolIndexer: SymbolIndexer | null = null

  constructor(private workspace: string, private noCache = false) {
    this.workspace = path.resolve(workspace)
    this.ts = resolveTypeScript(this.workspace)
    this.files = new Map()

    const config = loadTsConfig(this.workspace, this.ts)

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
      getCurrentDirectory: () => this.workspace,
      getCompilationSettings: () => config.options,
      getDefaultLibFileName: (options) =>
        this.ts.getDefaultLibFilePath(options),
      fileExists: this.ts.sys.fileExists,
      readFile: this.ts.sys.readFile,
      readDirectory: this.ts.sys.readDirectory,
      directoryExists: this.ts.sys.directoryExists,
      getDirectories: this.ts.sys.getDirectories,
      realpath: this.ts.sys.realpath,
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
    let content = this.getFileContent(fileName)
    if (!content) {
      content = this.ts.sys.readFile(fileName) ?? ''
    }
    const lines = content.split('\n')
    let offset = 0
    const maxLine = Math.min(line - 1, lines.length)
    for (let i = 0; i < maxLine; i++) {
      offset += lines[i].length + 1
    }
    return offset + column - 1
  }

  resolveFileName(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath
    return path.resolve(this.workspace, filePath)
  }

  getSymbolIndexer(): SymbolIndexer {
    if (!this.symbolIndexer) {
      this.symbolIndexer = new SymbolIndexer(this, this.workspace, this.noCache)
      this.symbolIndexer.initialize()
    }
    return this.symbolIndexer
  }

  updateFile(fileName: string, content: string): void {
    const resolved = this.resolveFileName(fileName)
    const existing = this.files.get(resolved)
    if (existing) {
      existing.version++
      existing.content = content
    } else {
      this.files.set(resolved, { version: 0, content })
    }
    this.invalidateSymbolIndex()
  }

  removeFile(fileName: string): void {
    this.files.delete(this.resolveFileName(fileName))
    this.invalidateSymbolIndex()
  }

  private invalidateSymbolIndex(): void {
    if (this.symbolIndexer) {
      this.symbolIndexer.invalidate()
    }
  }

  getMembers(fileName: string, line: number, column: number) {
    const resolved = this.resolveFileName(fileName)
    const pos = this.resolvePosition(resolved, line, column)

    const program = this.service.getProgram()
    if (!program) return undefined

    const sourceFile = program.getSourceFile(resolved)
    if (!sourceFile) return undefined

    const checker = program.getTypeChecker()
    const node = this.findNodeAtPosition(sourceFile, pos)
    if (!node) return undefined

    const type = checker.getTypeAtLocation(node)
    const properties = type.getProperties()

    return properties.map((prop) => {
      const propType = checker.getTypeOfSymbolAtLocation(prop, node)
      const typeString = checker.typeToString(propType)
      const isMethod = propType.getCallSignatures().length > 0

      return {
        name: prop.getName(),
        kind: isMethod ? 'method' : 'property',
        type: typeString,
      }
    })
  }

  private findNodeAtPosition(
    sourceFile: ts.SourceFile,
    offset: number,
  ): ts.Node | undefined {
    const tsModule = this.ts
    function find(node: ts.Node): ts.Node | undefined {
      if (offset >= node.getStart(sourceFile) && offset < node.getEnd()) {
        return tsModule.forEachChild(node, find) || node
      }
      return undefined
    }
    return find(sourceFile)
  }

  dispose(): void {
    this.service.dispose()
  }
}
