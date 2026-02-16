import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')

describe('TsMcpLanguageService', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('initializes with project files', () => {
    const files = svc.getProjectFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(f => f.endsWith('types.ts'))).toBe(true)
  })

  it('can read file content', () => {
    const typesFile = svc.getProjectFiles().find(f => f.endsWith('types.ts'))!
    const content = svc.getFileContent(typesFile)
    expect(content).toContain('interface User')
  })
})
