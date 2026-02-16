import { describe, it, expect } from 'vitest'
import { resolveTypeScript } from '../../src/project/resolve-typescript'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')

describe('resolveTypeScript', () => {
  it('returns typescript module for a valid workspace', () => {
    const ts = resolveTypeScript(fixtureDir)
    expect(ts).toBeDefined()
    expect(typeof ts.createLanguageService).toBe('function')
  })

  it('falls back to bundled typescript for non-existent workspace', () => {
    const ts = resolveTypeScript('/non/existent/path')
    expect(ts).toBeDefined()
    expect(typeof ts.createLanguageService).toBe('function')
  })
})
