import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTsMcpServer } from './server'

const args = process.argv.slice(2)
const workspaceIdx = args.indexOf('--workspace')
const workspace = workspaceIdx !== -1 ? args[workspaceIdx + 1] : process.cwd()
const noCache = args.includes('--no-cache')

const { server } = createTsMcpServer(workspace, { noCache })
const transport = new StdioServerTransport()
await server.connect(transport)
