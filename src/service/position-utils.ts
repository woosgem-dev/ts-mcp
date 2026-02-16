export function toOffset(content: string, line: number, column: number): number {
  const lines = content.split('\n')
  let offset = 0
  for (let i = 0; i < line - 1; i++) {
    offset += lines[i].length + 1
  }
  return offset + column - 1
}

export function toLineColumn(
  content: string,
  offset: number,
): { line: number; column: number } {
  const before = content.slice(0, offset)
  const line = before.split('\n').length
  const lastNewline = before.lastIndexOf('\n')
  const column = offset - lastNewline
  return { line, column }
}
