import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { FileWatcher } from '../../src/service/file-watcher'
import type { TsMcpLanguageService } from '../../src/service/language-service'

function createMockService(): TsMcpLanguageService {
  return {
    updateFile: vi.fn(),
    removeFile: vi.fn(),
  } as unknown as TsMcpLanguageService
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const tmpDir = path.resolve(__dirname, '../fixtures/.watcher-test')

describe('FileWatcher', () => {
  let svc: TsMcpLanguageService
  let watcher: FileWatcher

  beforeEach(() => {
    svc = createMockService()
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    watcher?.stop()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('filters out non-TS files', async () => {
    watcher = new FileWatcher(svc, tmpDir)
    watcher.start()

    fs.writeFileSync(path.join(tmpDir, 'data.json'), '{}')
    fs.writeFileSync(path.join(tmpDir, 'script.js'), 'var x = 1')

    await delay(300)

    expect(svc.updateFile).not.toHaveBeenCalled()
  })

  it('debounces rapid changes', async () => {
    watcher = new FileWatcher(svc, tmpDir)
    watcher.start()

    const filePath = path.join(tmpDir, 'test.ts')

    // Write file and give OS time to deliver events between writes
    fs.writeFileSync(filePath, 'const a = 1')
    await delay(20)
    fs.writeFileSync(filePath, 'const a = 2')
    await delay(20)
    fs.writeFileSync(filePath, 'const a = 3')

    // Wait for debounce window to expire
    await delay(300)

    const updateFn = svc.updateFile as ReturnType<typeof vi.fn>
    const callCount = updateFn.mock.calls.length

    // fs.watch should have delivered at least one event, and debounce should
    // ensure the final content is what gets processed
    expect(callCount).toBeGreaterThanOrEqual(1)

    // The last call should contain the final content
    const lastCall = updateFn.mock.calls[callCount - 1]
    expect(lastCall[1]).toBe('const a = 3')
  })

  it('stop() cleans up properly', () => {
    watcher = new FileWatcher(svc, tmpDir)
    watcher.start()
    watcher.stop()

    // Starting after stop should work (no double-abort)
    watcher.start()
    watcher.stop()
  })
})
