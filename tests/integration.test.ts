import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTsMcpServer } from '../src/server'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, 'fixtures/sample-project')

describe('ts-mcp integration', () => {
  let instance: ReturnType<typeof createTsMcpServer>

  beforeAll(() => {
    instance = createTsMcpServer(fixtureDir)
  })

  afterAll(() => {
    instance.languageService.dispose()
  })

  it('creates server with all tools registered', () => {
    expect(instance.server).toBeDefined()
    expect(instance.languageService).toBeDefined()
  })

  it('language service can find definitions', () => {
    const files = instance.languageService.getProjectFiles()
    expect(files.length).toBe(4)
  })
})
