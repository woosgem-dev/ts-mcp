import type ts from 'typescript'

export interface JsDocInfo {
  deprecated?: { message: string }
  params?: Array<{ name: string; description: string }>
  returns?: string
  throws?: string[]
  see?: string[]
  examples?: string[]
  customTags?: Record<string, string>
}

const TS_MCP_PREFIX = 'ts-mcp-'

export function extractJsDoc(tags: ts.JSDocTagInfo[]): JsDocInfo | undefined {
  if (!tags || tags.length === 0) return undefined

  const result: JsDocInfo = {}
  const customTags: Record<string, string> = {}

  for (const tag of tags) {
    const text = tag.text?.map(t => t.text).join('') ?? ''

    if (tag.name === 'deprecated') {
      result.deprecated = { message: text }
    } else if (tag.name === 'param') {
      result.params ??= []
      result.params.push({ name: '', description: text })
    } else if (tag.name === 'returns' || tag.name === 'return') {
      result.returns = text
    } else if (tag.name === 'throws' || tag.name === 'throw') {
      result.throws ??= []
      result.throws.push(text)
    } else if (tag.name === 'see') {
      result.see ??= []
      result.see.push(text)
    } else if (tag.name === 'example') {
      result.examples ??= []
      result.examples.push(text)
    } else if (tag.name.startsWith(TS_MCP_PREFIX)) {
      const key = tag.name.slice(TS_MCP_PREFIX.length)
      customTags[key] = text
    }
  }

  if (Object.keys(customTags).length > 0) {
    result.customTags = customTags
  }

  return Object.keys(result).length > 0 ? result : undefined
}
