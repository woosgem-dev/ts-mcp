import { describe, it, expect, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import {
  SingleServiceProvider,
  MultiServiceProvider,
} from '../../src/service/service-provider'
import path from 'node:path'

const sampleDir = path.resolve(__dirname, '../fixtures/sample-project')
const monorepoDir = path.resolve(__dirname, '../fixtures/monorepo-project')
const appTsconfig = path.join(monorepoDir, 'packages/app/tsconfig.json')
const sharedTsconfig = path.join(monorepoDir, 'packages/shared/tsconfig.json')

describe('SingleServiceProvider', () => {
  const svc = new TsMcpLanguageService(sampleDir)
  const provider = new SingleServiceProvider(svc)

  afterAll(() => {
    provider.dispose()
  })

  it('forFile() always returns the same service', () => {
    const result1 = provider.forFile('/any/file.ts')
    const result2 = provider.forFile('/other/file.ts')
    expect(result1).toBe(svc)
    expect(result2).toBe(svc)
  })

  it('all() returns array with one service', () => {
    const all = provider.all()
    expect(all).toHaveLength(1)
    expect(all[0]).toBe(svc)
  })
})

describe('MultiServiceProvider', () => {
  const provider = new MultiServiceProvider(
    monorepoDir,
    [appTsconfig, sharedTsconfig],
    true,
  )

  afterAll(() => {
    provider.dispose()
  })

  it('routes files to correct service', () => {
    const utilsFile = path.join(monorepoDir, 'packages/shared/src/utils.ts')
    const svc = provider.forFile(utilsFile)
    expect(svc).toBeDefined()
    expect(svc!.getProjectFiles().some(f => f.includes('utils.ts'))).toBe(true)
  })

  it('forFile() returns undefined for unknown files', () => {
    const svc = provider.forFile('/completely/unknown/file.ts')
    expect(svc).toBeUndefined()
  })

  it('all() returns all services', () => {
    const all = provider.all()
    expect(all).toHaveLength(2)
  })
})
