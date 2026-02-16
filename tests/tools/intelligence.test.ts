import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { getTypeInfo } from '../../src/tools/intelligence'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')
const typesFile = path.join(fixtureDir, 'src/types.ts')

describe('intelligence tools', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  describe('getTypeInfo', () => {
    it('returns type info for User interface', () => {
      const content = svc.getFileContent(typesFile)
      const match = content.indexOf('interface User {')
      const nameIdx = content.indexOf('User', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = getTypeInfo(svc, typesFile, line, column)
      expect(result).toBeDefined()
      expect(result!.displayString).toContain('User')
    })

    it('detects @deprecated on OldUserStore', () => {
      const content = svc.getFileContent(typesFile)
      const match = content.indexOf('interface OldUserStore')
      const nameIdx = content.indexOf('OldUserStore', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = getTypeInfo(svc, typesFile, line, column)
      expect(result).toBeDefined()
      expect(result!.jsdoc?.deprecated).toBeDefined()
    })
  })
})
