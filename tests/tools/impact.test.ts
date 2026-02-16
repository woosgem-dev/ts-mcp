import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { callHierarchy } from '../../src/tools/impact'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
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
