import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import {
  gotoDefinition,
  findReferences,
} from '../../src/tools/navigation'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const typesFile = path.join(fixtureDir, 'src/types.ts')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')
const controllerFile = path.join(fixtureDir, 'src/user-controller.ts')

describe('navigation tools', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  describe('gotoDefinition', () => {
    it('finds definition of UserRepository in user-service.ts', () => {
      const content = svc.getFileContent(serviceFile)
      const match = content.indexOf('UserRepository')
      const lines = content.slice(0, match).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = gotoDefinition(svc, serviceFile, line, column)
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].file).toContain('types.ts')
    })
  })

  describe('findReferences', () => {
    it('finds all references to getUserOrThrow', () => {
      const content = svc.getFileContent(serviceFile)
      const match = content.indexOf('getUserOrThrow')
      const lines = content.slice(0, match).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = findReferences(svc, serviceFile, line, column)
      // definition in user-service.ts, usage in user-controller.ts, export in index.ts
      expect(result.length).toBeGreaterThanOrEqual(2)
    })
  })
})
