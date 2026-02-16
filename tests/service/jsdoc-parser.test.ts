import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const typesFile = path.join(fixtureDir, 'src/types.ts')

function findLine(content: string, text: string): number {
  const idx = content.indexOf(text)
  return content.slice(0, idx).split('\n').length
}

describe('jsdoc-parser', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  it('extracts @deprecated tag', () => {
    const content = svc.getFileContent(typesFile)
    const line = findLine(content, 'interface OldUserStore')
    const nameStart = content.indexOf('OldUserStore', content.indexOf('interface OldUserStore'))
    const lineStart = content.lastIndexOf('\n', nameStart) + 1
    const column = nameStart - lineStart + 1

    const position = svc.resolvePosition(typesFile, line, column)
    const info = svc.getRawService().getQuickInfoAtPosition(typesFile, position)
    expect(info?.tags?.some(t => t.name === 'deprecated')).toBe(true)
  })

  it('extracts custom @ts-mcp- tags', () => {
    const content = svc.getFileContent(typesFile)
    const line = findLine(content, 'interface PaymentService')
    const nameStart = content.indexOf('PaymentService', content.indexOf('interface PaymentService'))
    const lineStart = content.lastIndexOf('\n', nameStart) + 1
    const column = nameStart - lineStart + 1

    const position = svc.resolvePosition(typesFile, line, column)
    const info = svc.getRawService().getQuickInfoAtPosition(typesFile, position)
    expect(info?.tags?.some(t => t.name === 'ts-mcp-caution')).toBe(true)
  })
})
