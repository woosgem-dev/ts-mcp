import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TsMcpLanguageService } from './service/language-service'

export function createTsMcpServer(workspace: string) {
  const server = new McpServer({
    name: 'ts-mcp',
    version: '0.1.0',
  })

  const languageService = new TsMcpLanguageService(workspace)

  return { server, languageService }
}
