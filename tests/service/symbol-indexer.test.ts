import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { SymbolIndexer } from '../../src/service/symbol-indexer'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const cacheDir = path.join(fixtureDir, '.ts-mcp')

function cleanCache() {
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true })
  }
}

describe('SymbolIndexer', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    cleanCache()
    svc = new TsMcpLanguageService(fixtureDir, true)
  })

  afterAll(() => {
    svc.dispose()
    cleanCache()
  })

  describe('buildIndex and query', () => {
    let indexer: SymbolIndexer

    beforeAll(() => {
      indexer = new SymbolIndexer(svc, fixtureDir, true)
      indexer.initialize()
    }, 60_000)

    it('finds symbols by exact name', () => {
      const results = indexer.query('UserRepository')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((s) => s.name === 'UserRepository')).toBe(true)
      const exact = results.find(
        (s) => s.name === 'UserRepository' && s.file.includes('types.ts'),
      )!
      expect(exact).toBeDefined()
      expect(exact.line).toBeGreaterThan(0)
      expect(exact.column).toBeGreaterThan(0)
    })

    it('finds symbols by exact name (case-insensitive)', () => {
      const results = indexer.query('User')
      expect(results.length).toBeGreaterThan(0)
      for (const s of results) {
        expect(s.name.toLowerCase()).toBe('user')
      }
    })

    it('returns empty for no match', () => {
      const results = indexer.query('NonExistentXYZ123')
      expect(results).toEqual([])
    })
  })

  describe('disk cache', () => {
    beforeAll(() => {
      cleanCache()
    })

    it('saves cache and loads same results', () => {
      const indexer1 = new SymbolIndexer(svc, fixtureDir)
      indexer1.initialize()

      expect(fs.existsSync(path.join(cacheDir, 'meta.json'))).toBe(true)
      expect(fs.existsSync(path.join(cacheDir, 'index.json'))).toBe(true)

      const firstResults = indexer1.query('UserRepository')

      // Second indexer should load from cache
      const indexer2 = new SymbolIndexer(svc, fixtureDir)
      indexer2.initialize()
      const cachedResults = indexer2.query('UserRepository')

      expect(cachedResults).toEqual(firstResults)
    }, 60_000)

    it('does not create cache when noCache is true', () => {
      cleanCache()
      const indexer = new SymbolIndexer(svc, fixtureDir, true)
      indexer.initialize()

      expect(fs.existsSync(cacheDir)).toBe(false)
    }, 60_000)
  })

  describe('cache invalidation', () => {
    it('rebuilds when file list changes', () => {
      cleanCache()
      const indexer1 = new SymbolIndexer(svc, fixtureDir)
      indexer1.initialize()

      // Tamper with meta to simulate file list change
      const metaPath = path.join(cacheDir, 'meta.json')
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      meta.files = ['nonexistent.ts']
      fs.writeFileSync(metaPath, JSON.stringify(meta))

      const indexer2 = new SymbolIndexer(svc, fixtureDir)
      indexer2.initialize()

      const results = indexer2.query('UserRepository')
      expect(results.length).toBeGreaterThan(0)
    }, 60_000)

    it('rebuilds when tsconfig hash changes', () => {
      cleanCache()
      const indexer1 = new SymbolIndexer(svc, fixtureDir)
      indexer1.initialize()

      // Tamper with meta to simulate tsconfig change
      const metaPath = path.join(cacheDir, 'meta.json')
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      meta.tsconfigHash = 'invalidhash'
      fs.writeFileSync(metaPath, JSON.stringify(meta))

      const indexer2 = new SymbolIndexer(svc, fixtureDir)
      indexer2.initialize()

      const results = indexer2.query('UserRepository')
      expect(results.length).toBeGreaterThan(0)
    }, 60_000)
  })
})
