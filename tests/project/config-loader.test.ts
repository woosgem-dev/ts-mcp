import { describe, it, expect } from 'vitest'
import { loadTsConfig } from '../../src/project/config-loader'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')

describe('loadTsConfig', () => {
  it('loads tsconfig.json and returns parsed config', () => {
    const config = loadTsConfig(fixtureDir)
    expect(config.options).toBeDefined()
    expect(config.options.strict).toBe(true)
    expect(config.fileNames.length).toBeGreaterThan(0)
  })

  it('includes all .ts files from the project', () => {
    const config = loadTsConfig(fixtureDir)
    const fileNames = config.fileNames.map(f => path.basename(f))
    expect(fileNames).toContain('types.ts')
    expect(fileNames).toContain('user-service.ts')
    expect(fileNames).toContain('user-controller.ts')
    expect(fileNames).toContain('index.ts')
  })
})
