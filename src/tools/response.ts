interface TextContent {
  type: 'text'
  text: string
}

interface ToolResponse {
  content: TextContent[]
  isError?: boolean
}

export function textContent(text: string): TextContent {
  return { type: 'text', text }
}

export function jsonResponse(data: unknown, ...hints: string[]): ToolResponse {
  const content = [textContent(JSON.stringify(data, null, 2))]
  for (const hint of hints) {
    content.push(textContent(hint))
  }
  return { content }
}

export function errorResponse(toolName: string, error: unknown): ToolResponse {
  const message = error instanceof Error ? error.message : String(error)
  return {
    isError: true,
    content: [textContent(`${toolName} failed: ${message}`)],
  }
}

export function noProjectResponse(file: string): ToolResponse {
  return {
    isError: true,
    content: [textContent(`No project found for file: ${file}`)],
  }
}
