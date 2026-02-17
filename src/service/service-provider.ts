import path from 'node:path'
import { TsMcpLanguageService } from './language-service'

export interface ServiceProvider {
  forFile(filePath: string): TsMcpLanguageService | undefined
  all(): TsMcpLanguageService[]
  dispose(): void
}

export class SingleServiceProvider implements ServiceProvider {
  constructor(private service: TsMcpLanguageService) {}

  forFile(): TsMcpLanguageService {
    return this.service
  }

  all(): TsMcpLanguageService[] {
    return [this.service]
  }

  dispose(): void {
    this.service.dispose()
  }
}

export class MultiServiceProvider implements ServiceProvider {
  private services: TsMcpLanguageService[] = []
  private tsconfigDirs: string[] = []

  constructor(
    workspace: string,
    tsconfigPaths: string[],
    noCache?: boolean,
  ) {
    for (const tsconfigPath of tsconfigPaths) {
      const dir = path.dirname(tsconfigPath)
      this.tsconfigDirs.push(dir)
      this.services.push(new TsMcpLanguageService(dir, noCache))
    }
  }

  forFile(filePath: string): TsMcpLanguageService | undefined {
    const resolved = path.resolve(filePath)

    // Exact match: check if any service owns this file
    for (const svc of this.services) {
      const files = svc.getProjectFiles()
      if (files.includes(resolved)) {
        return svc
      }
    }

    // Nearest ancestor: find the tsconfig directory that is the closest parent
    let bestMatch: TsMcpLanguageService | undefined
    let bestLen = 0

    for (let i = 0; i < this.tsconfigDirs.length; i++) {
      const dir = this.tsconfigDirs[i]
      if (resolved.startsWith(dir + path.sep) && dir.length > bestLen) {
        bestLen = dir.length
        bestMatch = this.services[i]
      }
    }

    return bestMatch
  }

  all(): TsMcpLanguageService[] {
    return this.services
  }

  dispose(): void {
    for (const svc of this.services) {
      svc.dispose()
    }
  }
}
