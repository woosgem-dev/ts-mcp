import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initProject } from '../src/init'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('initProject', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-mcp-init-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('creates .claude/CLAUDE.md when it does not exist', () => {
    initProject(tmpDir)

    const content = fs.readFileSync(path.join(tmpDir, '.claude/CLAUDE.md'), 'utf-8')
    expect(content).toContain('## TypeScript Code Navigation (ts-mcp)')
    expect(content).toContain('goto_definition')
    expect(content).toContain('find_references')
    expect(content).toContain('diagnostics')
  })

  it('appends to existing CLAUDE.md without duplicating', () => {
    const claudeDir = path.join(tmpDir, '.claude')
    fs.mkdirSync(claudeDir)
    fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), '# My Project\n\nExisting content.')

    initProject(tmpDir)

    const content = fs.readFileSync(path.join(claudeDir, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('# My Project')
    expect(content).toContain('Existing content.')
    expect(content).toContain('## TypeScript Code Navigation (ts-mcp)')
  })

  it('does not duplicate when run twice', () => {
    initProject(tmpDir)
    initProject(tmpDir)

    const content = fs.readFileSync(path.join(tmpDir, '.claude/CLAUDE.md'), 'utf-8')
    const matches = content.match(/## TypeScript Code Navigation \(ts-mcp\)/g)
    expect(matches).toHaveLength(1)
  })
})
