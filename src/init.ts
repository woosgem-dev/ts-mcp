import fs from 'node:fs'
import path from 'node:path'

const CLAUDE_MD_SNIPPET = `## TypeScript Code Navigation (ts-mcp)

This project has ts-mcp installed. For TypeScript code navigation,
ALWAYS prefer ts-mcp tools over Grep/Read:

- Symbol definition → \`goto_definition\` (not Grep)
- Symbol references → \`find_references\` (not Grep)
- Symbol search → \`workspace_symbols\` (not Grep)
- File structure → \`document_symbols\` (not Read)
- Type navigation → \`goto_type_definition\`
- Member listing → \`list_members\`
- Call chain → \`call_hierarchy\`
- Type implementations → \`type_hierarchy\`
- Change impact → \`impact_analysis\`
- Type/docs info → \`get_type_info\`
- Rename → \`rename_symbol\`
- Errors → \`diagnostics\`
`

const SECTION_MARKER = '## TypeScript Code Navigation (ts-mcp)'
const MCP_SERVER_KEY = 'ts-mcp'

export function initProject(workspace: string): void {
  const claudeDir = path.join(workspace, '.claude')

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true })
  }

  setupClaudeMd(claudeDir)
  setupMcpJson(workspace)
}

function setupClaudeMd(claudeDir: string): void {
  const claudeMdPath = path.join(claudeDir, 'CLAUDE.md')

  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf-8')
    if (existing.includes(SECTION_MARKER)) {
      console.log('✓ .claude/CLAUDE.md — ts-mcp section already exists')
      return
    }
    fs.writeFileSync(claudeMdPath, existing.trimEnd() + '\n\n' + CLAUDE_MD_SNIPPET)
    console.log('✓ .claude/CLAUDE.md — appended ts-mcp section')
  } else {
    fs.writeFileSync(claudeMdPath, CLAUDE_MD_SNIPPET)
    console.log('✓ .claude/CLAUDE.md — created')
  }
}

function setupMcpJson(workspace: string): void {
  const mcpJsonPath = path.join(workspace, '.mcp.json')

  const serverConfig = {
    command: 'ts-mcp',
    args: [workspace],
  }

  if (fs.existsSync(mcpJsonPath)) {
    const existing = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'))
    if (existing.mcpServers?.[MCP_SERVER_KEY]) {
      console.log('✓ .mcp.json — ts-mcp server already configured')
      return
    }
    existing.mcpServers = existing.mcpServers ?? {}
    existing.mcpServers[MCP_SERVER_KEY] = serverConfig
    fs.writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2) + '\n')
    console.log('✓ .mcp.json — appended ts-mcp server')
  } else {
    const config = { mcpServers: { [MCP_SERVER_KEY]: serverConfig } }
    fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n')
    console.log('✓ .mcp.json — created')
  }
}
