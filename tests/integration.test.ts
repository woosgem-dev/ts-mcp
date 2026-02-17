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
    instance.provider.dispose()
  })

  it('creates server with all tools registered', () => {
    expect(instance.server).toBeDefined()
    expect(instance.provider).toBeDefined()
  })

  it('language service can find definitions', () => {
    const services = instance.provider.all()
    const files = services[0].getProjectFiles()
    expect(files.length).toBe(4)
  })
})
