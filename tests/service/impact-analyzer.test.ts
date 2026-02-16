import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { analyzeImpact } from '../../src/service/impact-analyzer'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')

describe('analyzeImpact', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('calculates blast radius for getUserOrThrow', () => {
    const content = svc.getFileContent(serviceFile)
    const fnIndex = content.indexOf('async function getUserOrThrow')
    const nameIdx = content.indexOf('getUserOrThrow', fnIndex)
    const lines = content.slice(0, nameIdx).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = analyzeImpact(svc, serviceFile, line, column)

    expect(result.symbol).toBe('getUserOrThrow')
    expect(result.directReferences).toBeGreaterThanOrEqual(2)
    expect(result.affectedFiles.length).toBeGreaterThanOrEqual(2)
    expect(result.callers.length).toBeGreaterThanOrEqual(1)
  })
})
