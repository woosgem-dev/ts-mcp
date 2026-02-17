import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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

  describe('mutation methods', () => {
    it('updateFile bumps version and updates content for existing file', () => {
      const typesFile = svc.getProjectFiles().find(f => f.endsWith('types.ts'))!
      const originalContent = svc.getFileContent(typesFile)
      const newContent = originalContent + '\n// updated'

      svc.updateFile(typesFile, newContent)

      expect(svc.getFileContent(typesFile)).toBe(newContent)

      // Restore original content
      svc.updateFile(typesFile, originalContent)
    })

    it('updateFile adds new file when it does not exist', () => {
      const newFile = path.resolve(fixtureDir, 'new-file.ts')
      const content = 'export const x = 1'

      svc.updateFile(newFile, content)

      expect(svc.getProjectFiles()).toContain(newFile)
      expect(svc.getFileContent(newFile)).toBe(content)

      // Clean up
      svc.removeFile(newFile)
    })

    it('removeFile removes file from project files', () => {
      const tempFile = path.resolve(fixtureDir, 'temp.ts')
      svc.updateFile(tempFile, 'export const y = 2')
      expect(svc.getProjectFiles()).toContain(tempFile)

      svc.removeFile(tempFile)

      expect(svc.getProjectFiles()).not.toContain(tempFile)
    })

    it('updateFile invalidates symbol index', () => {
      // Force creation of symbol indexer
      const indexer = svc.getSymbolIndexer()
      const invalidateSpy = vi.spyOn(indexer, 'invalidate')

      const typesFile = svc.getProjectFiles().find(f => f.endsWith('types.ts'))!
      const content = svc.getFileContent(typesFile)
      svc.updateFile(typesFile, content)

      expect(invalidateSpy).toHaveBeenCalled()
      invalidateSpy.mockRestore()
    })
  })
})
