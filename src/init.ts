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

export function initProject(workspace: string): void {
  const claudeDir = path.join(workspace, '.claude')
  const claudeMdPath = path.join(claudeDir, 'CLAUDE.md')

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true })
  }

  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf-8')
    if (existing.includes(SECTION_MARKER)) {
      console.log('ts-mcp section already exists in .claude/CLAUDE.md')
      return
    }
    fs.writeFileSync(claudeMdPath, existing.trimEnd() + '\n\n' + CLAUDE_MD_SNIPPET)
    console.log('Added ts-mcp section to .claude/CLAUDE.md')
  } else {
    fs.writeFileSync(claudeMdPath, CLAUDE_MD_SNIPPET)
    console.log('Created .claude/CLAUDE.md with ts-mcp section')
  }
}
