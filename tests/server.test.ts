import { describe, it, expect } from 'vitest'
import { createTsMcpServer } from '../src/server'

describe('createTsMcpServer', () => {
  it('creates a server instance', () => {
    const server = createTsMcpServer('/tmp/fake-workspace')
    expect(server).toBeDefined()
  })
})
