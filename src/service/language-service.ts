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
