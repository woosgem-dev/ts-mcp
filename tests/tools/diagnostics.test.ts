import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { getDiagnostics } from '../../src/tools/diagnostics'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const typesFile = path.join(fixtureDir, 'src/types.ts')

describe('diagnostics', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('returns no errors for valid files', () => {
    const result = getDiagnostics(svc, typesFile)
    const errors = result.filter(d => d.severity === 'error')
    expect(errors).toEqual([])
  })

  it('returns diagnostics for all files when no file specified', () => {
    const result = getDiagnostics(svc)
    expect(result).toBeDefined()
  })
})
