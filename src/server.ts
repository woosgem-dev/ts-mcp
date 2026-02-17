import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TsMcpLanguageService } from './service/language-service'
import { discoverTsConfigs } from './project/tsconfig-discovery'
import { SingleServiceProvider, MultiServiceProvider } from './service/service-provider'
import type { ServiceProvider } from './service/service-provider'
import { registerNavigationTools } from './tools/navigation'
import { registerImpactTools } from './tools/impact'
import { registerIntelligenceTools } from './tools/intelligence'
import { registerDiagnosticsTools } from './tools/diagnostics'

export interface ServerOptions {
  noCache?: boolean
  projects?: string[]
}

export function createTsMcpServer(workspace: string, options?: ServerOptions) {
  const server = new McpServer({
    name: 'ts-mcp',
    version: '0.1.0',
  })

  const tsconfigPaths = options?.projects ?? discoverTsConfigs(workspace)

  const provider: ServiceProvider = tsconfigPaths.length <= 1
    ? new SingleServiceProvider(new TsMcpLanguageService(workspace, options?.noCache))
    : new MultiServiceProvider(workspace, tsconfigPaths, options?.noCache)

  registerNavigationTools(server, provider)
  registerImpactTools(server, provider)
  registerIntelligenceTools(server, provider)
  registerDiagnosticsTools(server, provider)

  return { server, provider }
}
