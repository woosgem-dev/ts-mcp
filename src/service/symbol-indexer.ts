import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { TsMcpLanguageService } from './language-service'
import { toLineColumn } from './position-utils'

export interface IndexedSymbol {
  name: string
  kind: string
  file: string
  line: number
  column: number
}

interface InternalSymbol {
  name: string
  lowerName: string
  kind: string
  file: string
  line: number
  column: number
}

interface CacheMeta {
  files: string[]
  tsconfigHash: string
}

interface CompactCache {
  kinds: string[]
  files: string[]
  symbols: [string, number, number, number, number][]
}

const CACHE_DIR = '.ts-mcp'
const META_FILE = 'meta.json'
const INDEX_FILE = 'index.json'

export class SymbolIndexer {
  private symbolMap = new Map<string, InternalSymbol[]>()
  private cacheDir: string
  private initialized = false

  constructor(
    private svc: TsMcpLanguageService,
    private workspace: string,
    private noCache = false,
  ) {
    this.cacheDir = path.join(workspace, CACHE_DIR)
  }

  initialize(): void {
    if (this.initialized) return
    if (!this.noCache && this.loadCache()) {
      this.initialized = true
      return
    }
    this.buildIndex()
    if (!this.noCache) {
      this.saveCache()
    }
    this.initialized = true
  }

  invalidate(): void {
    this.symbolMap.clear()
    this.initialized = false
  }

  query(pattern: string): IndexedSymbol[] {
    this.initialize()
    const entries = this.symbolMap.get(pattern.toLowerCase())
    if (!entries) return []
    return entries.map((s) => ({
      name: s.name,
      kind: s.kind,
      file: s.file,
      line: s.line,
      column: s.column,
    }))
  }

  private isCacheValid(): boolean {
    const metaPath = path.join(this.cacheDir, META_FILE)
    const indexPath = path.join(this.cacheDir, INDEX_FILE)

    if (!fs.existsSync(metaPath) || !fs.existsSync(indexPath)) {
      return false
    }

    const meta: CacheMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    const currentFiles = this.svc.getProjectFiles().slice().sort()
    const cachedFiles = meta.files.slice().sort()

    if (currentFiles.length !== cachedFiles.length) return false
    for (let i = 0; i < currentFiles.length; i++) {
      if (currentFiles[i] !== cachedFiles[i]) return false
    }

    const currentHash = this.getTsconfigHash()
    return meta.tsconfigHash === currentHash
  }

  private buildIndex(): void {
    this.symbolMap.clear()
    const ts = this.svc.getTs()

    for (const fileName of this.svc.getProjectFiles()) {
      const content = this.svc.getFileContent(fileName) || ts.sys.readFile(fileName) || ''
      const items = this.svc.getRawService().getNavigationBarItems(fileName)
      this.flattenNavItems(items, fileName, content)
    }
  }

  private flattenNavItems(
    items: { text: string; kind: string; spans: { start: number; length: number }[]; childItems: any[] }[],
    fileName: string,
    content: string,
  ): void {
    for (const item of items) {
      if (item.text === '<global>') {
        this.flattenNavItems(item.childItems, fileName, content)
        continue
      }
      const loc = toLineColumn(content, item.spans[0].start)
      const sym: InternalSymbol = {
        name: item.text,
        lowerName: item.text.toLowerCase(),
        kind: item.kind,
        file: fileName,
        line: loc.line,
        column: loc.column,
      }
      const existing = this.symbolMap.get(sym.lowerName)
      if (existing) {
        existing.push(sym)
      } else {
        this.symbolMap.set(sym.lowerName, [sym])
      }
      if (item.childItems) {
        this.flattenNavItems(item.childItems, fileName, content)
      }
    }
  }

  private saveCache(): void {
    fs.mkdirSync(this.cacheDir, { recursive: true })

    const meta: CacheMeta = {
      files: this.svc.getProjectFiles(),
      tsconfigHash: this.getTsconfigHash(),
    }

    const kindMap = new Map<string, number>()
    const fileMap = new Map<string, number>()
    const kinds: string[] = []
    const files: string[] = []

    const compactSymbols: [string, number, number, number, number][] = []
    for (const entries of this.symbolMap.values()) {
      for (const s of entries) {
        if (!kindMap.has(s.kind)) {
          kindMap.set(s.kind, kinds.length)
          kinds.push(s.kind)
        }
        const relFile = path.relative(this.workspace, s.file)
        if (!fileMap.has(relFile)) {
          fileMap.set(relFile, files.length)
          files.push(relFile)
        }
        compactSymbols.push([
          s.name,
          kindMap.get(s.kind)!,
          fileMap.get(relFile)!,
          s.line,
          s.column,
        ])
      }
    }

    const data: CompactCache = { kinds, files, symbols: compactSymbols }

    fs.writeFileSync(
      path.join(this.cacheDir, META_FILE),
      JSON.stringify(meta),
    )
    fs.writeFileSync(
      path.join(this.cacheDir, INDEX_FILE),
      JSON.stringify(data),
    )
  }

  private loadCache(): boolean {
    if (!this.isCacheValid()) return false

    const indexPath = path.join(this.cacheDir, INDEX_FILE)
    const data: CompactCache = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

    this.symbolMap.clear()
    for (const [name, kindIdx, fileIdx, line, column] of data.symbols) {
      const sym: InternalSymbol = {
        name,
        lowerName: name.toLowerCase(),
        kind: data.kinds[kindIdx],
        file: path.resolve(this.workspace, data.files[fileIdx]),
        line,
        column,
      }
      const existing = this.symbolMap.get(sym.lowerName)
      if (existing) {
        existing.push(sym)
      } else {
        this.symbolMap.set(sym.lowerName, [sym])
      }
    }

    return true
  }

  private getTsconfigHash(): string {
    const tsconfigPath = path.join(this.workspace, 'tsconfig.json')
    if (!fs.existsSync(tsconfigPath)) return ''
    const content = fs.readFileSync(tsconfigPath, 'utf-8')
    return crypto.createHash('md5').update(content).digest('hex')
  }
}
