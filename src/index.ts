import path from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTsMcpServer } from './server'
import { initProject } from './init'

const args = process.argv.slice(2)
const workspaceIdx = args.indexOf('--workspace')
const workspace = workspaceIdx !== -1 ? args[workspaceIdx + 1] : process.cwd()

if (args.includes('--init')) {
  initProject(workspace)
  process.exit(0)
}

const noCache = args.includes('--no-cache')

const projectsIdx = args.indexOf('--projects')
const projects = projectsIdx !== -1
  ? args[projectsIdx + 1].split(',').map(p => path.resolve(p))
  : undefined

const { server } = createTsMcpServer(workspace, { noCache, projects })
const transport = new StdioServerTransport()
await server.connect(transport)
