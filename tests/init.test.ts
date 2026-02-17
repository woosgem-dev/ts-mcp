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

  it('creates settings file and CLAUDE.md reference', () => {
    initProject(tmpDir)

    const settings = fs.readFileSync(path.join(tmpDir, '.claude/ts-mcp-settings.md'), 'utf-8')
    expect(settings).toContain('goto_definition')
    expect(settings).toContain('Custom TSDoc tags')

    const claudeMd = fs.readFileSync(path.join(tmpDir, '.claude/CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('ts-mcp-settings.md')
  })

  it('appends reference to existing CLAUDE.md', () => {
    const claudeDir = path.join(tmpDir, '.claude')
    fs.mkdirSync(claudeDir)
    fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), '# My Project\n\nExisting content.')

    initProject(tmpDir)

    const content = fs.readFileSync(path.join(claudeDir, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('# My Project')
    expect(content).toContain('Existing content.')
    expect(content).toContain('ts-mcp-settings.md')
  })

  it('does not duplicate reference when run twice', () => {
    initProject(tmpDir)
    initProject(tmpDir)

    const content = fs.readFileSync(path.join(tmpDir, '.claude/CLAUDE.md'), 'utf-8')
    const matches = content.match(/See \[ts-mcp-settings\.md\]/g)
    expect(matches).toHaveLength(1)
  })

  it('overwrites settings file on re-run', () => {
    initProject(tmpDir)

    const settingsPath = path.join(tmpDir, '.claude/ts-mcp-settings.md')
    fs.writeFileSync(settingsPath, 'old content')

    initProject(tmpDir)

    const content = fs.readFileSync(settingsPath, 'utf-8')
    expect(content).toContain('goto_definition')
    expect(content).not.toContain('old content')
  })
})
