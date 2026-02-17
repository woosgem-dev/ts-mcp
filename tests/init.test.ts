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

  it('creates settings file under .claude/rules/', () => {
    initProject(tmpDir)

    const settings = fs.readFileSync(path.join(tmpDir, '.claude/rules/ts-mcp-settings.md'), 'utf-8')
    expect(settings).toContain('goto_definition')
    expect(settings).toContain('Custom TSDoc tags')
    expect(settings).toContain('Auto-generated')
  })

  it('creates .mcp.json at project root', () => {
    initProject(tmpDir)

    const mcpJson = JSON.parse(fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf-8'))
    expect(mcpJson.mcpServers['ts-mcp']).toBeDefined()
    expect(mcpJson.mcpServers['ts-mcp'].command).toBe('ts-mcp')
  })

  it('does not duplicate mcp server when run twice', () => {
    initProject(tmpDir)
    initProject(tmpDir)

    const mcpJson = JSON.parse(fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf-8'))
    expect(Object.keys(mcpJson.mcpServers)).toHaveLength(1)
  })

  it('overwrites settings file on re-run', () => {
    initProject(tmpDir)

    const settingsPath = path.join(tmpDir, '.claude/rules/ts-mcp-settings.md')
    fs.writeFileSync(settingsPath, 'old content')

    initProject(tmpDir)

    const content = fs.readFileSync(settingsPath, 'utf-8')
    expect(content).toContain('goto_definition')
    expect(content).not.toContain('old content')
  })

  it('appends to existing .mcp.json', () => {
    const mcpJsonPath = path.join(tmpDir, '.mcp.json')
    fs.writeFileSync(mcpJsonPath, JSON.stringify({
      mcpServers: { 'other-server': { command: 'other' } }
    }, null, 2))

    initProject(tmpDir)

    const mcpJson = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'))
    expect(mcpJson.mcpServers['other-server']).toBeDefined()
    expect(mcpJson.mcpServers['ts-mcp']).toBeDefined()
  })

  it('does not create CLAUDE.md', () => {
    initProject(tmpDir)

    expect(fs.existsSync(path.join(tmpDir, '.claude/CLAUDE.md'))).toBe(false)
  })
})
