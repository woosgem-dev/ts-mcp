import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TsMcpLanguageService } from './service/language-service'
import { FileWatcher } from './service/file-watcher'
import { registerNavigationTools } from './tools/navigation'
import { registerImpactTools } from './tools/impact'
import { registerIntelligenceTools } from './tools/intelligence'
import { registerDiagnosticsTools } from './tools/diagnostics'

export interface ServerOptions {
  noCache?: boolean
  watch?: boolean
}

export function createTsMcpServer(workspace: string, options?: ServerOptions) {
  const server = new McpServer({
    name: 'ts-mcp',
    version: '0.1.0',
  })

  const languageService = new TsMcpLanguageService(workspace, options?.noCache)

  registerNavigationTools(server, languageService)
  registerImpactTools(server, languageService)
  registerIntelligenceTools(server, languageService)
  registerDiagnosticsTools(server, languageService)

  let fileWatcher: FileWatcher | undefined
  if (options?.watch) {
    fileWatcher = new FileWatcher(languageService, workspace)
    fileWatcher.start()
  }

  return { server, languageService, fileWatcher }
}
