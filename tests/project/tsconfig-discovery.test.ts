import { describe, it, expect } from 'vitest'
import { discoverTsConfigs } from '../../src/project/tsconfig-discovery'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const monorepoDir = path.resolve(__dirname, '../fixtures/monorepo-project')
const sampleDir = path.resolve(__dirname, '../fixtures/sample-project')

describe('discoverTsConfigs', () => {
  it('discovers tsconfig.json at root level', () => {
    const results = discoverTsConfigs(sampleDir)
    expect(results).toHaveLength(1)
    expect(results[0]).toBe(path.join(sampleDir, 'tsconfig.json'))
  })

  it('discovers nested tsconfig.json files', () => {
    const results = discoverTsConfigs(monorepoDir)
    expect(results).toHaveLength(2)
    expect(results).toContain(
      path.join(monorepoDir, 'packages/app/tsconfig.json'),
    )
    expect(results).toContain(
      path.join(monorepoDir, 'packages/shared/tsconfig.json'),
    )
  })

  it('respects maxDepth parameter', () => {
    const results = discoverTsConfigs(monorepoDir, 1)
    expect(results).toHaveLength(0)
  })

  it('excludes node_modules directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsconfig-test-'))
    const nmDir = path.join(tmpDir, 'node_modules', 'some-pkg')
    fs.mkdirSync(nmDir, { recursive: true })
    fs.writeFileSync(path.join(nmDir, 'tsconfig.json'), '{}')
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}')

    const results = discoverTsConfigs(tmpDir)
    expect(results).toHaveLength(1)
    expect(results[0]).toBe(path.join(tmpDir, 'tsconfig.json'))

    fs.rmSync(tmpDir, { recursive: true })
  })
})
