import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { getTypeInfo, renameSymbol, listMembers } from '../../src/tools/intelligence'
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

  describe('listMembers', () => {
    it('lists properties of the User interface', () => {
      // Position on 'User' in 'interface User {'
      const content = svc.getFileContent(typesFile)
      const match = content.indexOf('interface User {')
      const nameIdx = content.indexOf('User', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = listMembers(svc, typesFile, line, column)
      expect(result).toBeDefined()
      const names = result!.map((m) => m.name)
      expect(names).toContain('id')
      expect(names).toContain('name')
      expect(names).toContain('email')
      expect(result!.every((m) => m.kind === 'property')).toBe(true)
    })

    it('lists methods of the UserRepository interface', () => {
      const content = svc.getFileContent(typesFile)
      const match = content.indexOf('interface UserRepository')
      const nameIdx = content.indexOf('UserRepository', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = listMembers(svc, typesFile, line, column)
      expect(result).toBeDefined()
      const names = result!.map((m) => m.name)
      expect(names).toContain('findById')
      expect(names).toContain('findAll')
      expect(names).toContain('save')
      expect(result!.every((m) => m.kind === 'method')).toBe(true)
    })

    it('lists members of a class instance', () => {
      // Position on 'repo' in 'constructor(private repo: UserRepository)'
      const content = svc.getFileContent(path.join(fixtureDir, 'src/user-controller.ts'))
      const controllerFile = path.join(fixtureDir, 'src/user-controller.ts')
      const match = content.indexOf('private repo')
      const nameIdx = content.indexOf('repo', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = listMembers(svc, controllerFile, line, column)
      expect(result).toBeDefined()
      const names = result!.map((m) => m.name)
      expect(names).toContain('findById')
      expect(names).toContain('findAll')
      expect(names).toContain('save')
    })
  })

  describe('renameSymbol', () => {
    it('finds all rename locations for getUserOrThrow', () => {
      const content = svc.getFileContent(serviceFile)
      const fnIndex = content.indexOf('async function getUserOrThrow')
      const nameIdx = content.indexOf('getUserOrThrow', fnIndex)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = renameSymbol(svc, serviceFile, line, column, 'getRequiredUser')
      expect(result.locations.length).toBeGreaterThanOrEqual(2)
      expect(result.locations.some(l => l.file.includes('user-controller'))).toBe(true)
    })
  })
})
