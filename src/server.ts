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
