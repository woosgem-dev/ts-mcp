import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { callHierarchy, typeHierarchy } from '../../src/tools/impact'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const typesFile = path.join(fixtureDir, 'src/types.ts')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')

describe('callHierarchy', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('finds incoming calls to getUserOrThrow', () => {
    const content = svc.getFileContent(serviceFile)
    const fnIndex = content.indexOf('async function getUserOrThrow')
    const fnNameIndex = content.indexOf('getUserOrThrow', fnIndex)
    const lines = content.slice(0, fnNameIndex).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = callHierarchy(svc, serviceFile, line, column, 'incoming')
    // UserController.getUser calls getUserOrThrow
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some(r => r.from.includes('getUser') || r.fromFile.includes('user-controller'))).toBe(true)
  })

  it('finds outgoing calls from getUserOrThrow', () => {
    const content = svc.getFileContent(serviceFile)
    const fnIndex = content.indexOf('async function getUserOrThrow')
    const fnNameIndex = content.indexOf('getUserOrThrow', fnIndex)
    const lines = content.slice(0, fnNameIndex).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = callHierarchy(svc, serviceFile, line, column, 'outgoing')
    // getUserOrThrow calls repository.findById
    expect(result.length).toBeGreaterThanOrEqual(1)
  })
})

describe('typeHierarchy', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('finds implementations of UserRepository', () => {
    const content = svc.getFileContent(typesFile)
    const match = content.indexOf('interface UserRepository')
    const nameIdx = content.indexOf('UserRepository', match)
    const lines = content.slice(0, nameIdx).split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const result = typeHierarchy(svc, typesFile, line, column)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some(r => r.name.includes('InMemoryUserRepository'))).toBe(true)
  })
})
