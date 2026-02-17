import fs from 'node:fs'
import path from 'node:path'
import type { TsMcpLanguageService } from './language-service'

const TS_EXTENSIONS = new Set(['.ts', '.tsx'])
const DEBOUNCE_MS = 100

export class FileWatcher {
  private abortController: AbortController | null = null
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private svc: TsMcpLanguageService,
    private workspace: string,
  ) {}

  start(): void {
    if (this.abortController) return

    this.abortController = new AbortController()

    try {
      const watcher = fs.watch(this.workspace, {
        recursive: true,
        signal: this.abortController.signal,
      })

      watcher.on('change', (_event, filename) => {
        if (typeof filename !== 'string') return
        this.handleChange(filename)
      })

      watcher.on('error', () => {
        // Silently ignore watch errors (e.g., too many watchers)
      })
    } catch {
      // fs.watch may throw on unsupported platforms
      this.abortController = null
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
  }

  private handleChange(relativePath: string): void {
    if (!this.shouldProcess(relativePath)) return

    const fullPath = path.resolve(this.workspace, relativePath)

    const existing = this.debounceTimers.get(fullPath)
    if (existing) clearTimeout(existing)

    this.debounceTimers.set(
      fullPath,
      setTimeout(() => {
        this.debounceTimers.delete(fullPath)
        this.processFileChange(fullPath)
      }, DEBOUNCE_MS),
    )
  }

  private shouldProcess(relativePath: string): boolean {
    if (relativePath.includes('node_modules')) return false
    const ext = path.extname(relativePath)
    return TS_EXTENSIONS.has(ext)
  }

  private processFileChange(fullPath: string): void {
    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        this.svc.updateFile(fullPath, content)
      } else {
        this.svc.removeFile(fullPath)
      }
    } catch {
      // Ignore read failures (file may be mid-write or locked)
    }
  }
}
