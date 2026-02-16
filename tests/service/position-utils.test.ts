import { describe, it, expect } from 'vitest'
import { toOffset, toLineColumn } from '../../src/service/position-utils'

describe('position-utils', () => {
  const content = 'line1\nline2\nline3'

  it('converts line:column to offset', () => {
    expect(toOffset(content, 1, 1)).toBe(0)   // start of line1
    expect(toOffset(content, 2, 1)).toBe(6)   // start of line2
    expect(toOffset(content, 2, 3)).toBe(8)   // 'n' in line2
  })

  it('converts offset to line:column', () => {
    expect(toLineColumn(content, 0)).toEqual({ line: 1, column: 1 })
    expect(toLineColumn(content, 6)).toEqual({ line: 2, column: 1 })
    expect(toLineColumn(content, 8)).toEqual({ line: 2, column: 3 })
  })
})
