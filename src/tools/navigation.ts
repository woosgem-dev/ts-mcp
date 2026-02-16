import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import { toLineColumn } from '../service/position-utils'

export interface DefinitionResult {
  file: string
  line: number
  column: number
  text: string
}

export interface ReferenceResult {
  file: string
  line: number
  column: number
  text: string
}

export function gotoDefinition(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): DefinitionResult[] {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const definitions = svc.getRawService().getDefinitionAtPosition(fileName, position)

  if (!definitions) return []

  return definitions.map((def) => {
    const content = svc.getFileContent(def.fileName) || svc.getTs().sys.readFile(def.fileName) || ''
    const loc = toLineColumn(content, def.textSpan.start)
    const text = content.slice(def.textSpan.start, def.textSpan.start + def.textSpan.length)
    return {
      file: def.fileName,
      line: loc.line,
      column: loc.column,
      text,
    }
  })
}

export function findReferences(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): ReferenceResult[] {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const refs = svc.getRawService().findReferences(fileName, position)

  if (!refs) return []

  const results: ReferenceResult[] = []
  for (const group of refs) {
    for (const ref of group.references) {
      const content = svc.getFileContent(ref.fileName) || svc.getTs().sys.readFile(ref.fileName) || ''
      const loc = toLineColumn(content, ref.textSpan.start)
      const text = content.slice(ref.textSpan.start, ref.textSpan.start + ref.textSpan.length)
      results.push({
        file: ref.fileName,
        line: loc.line,
        column: loc.column,
        text,
      })
    }
  }
  return results
}

export function registerNavigationTools(
  mcpServer: McpServer,
  svc: TsMcpLanguageService,
): void {
  mcpServer.tool(
    'goto_definition',
    'Find where a symbol is defined. Use instead of grep to navigate to source.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    async ({ file, line, column }) => {
      const results = gotoDefinition(svc, file, line, column)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(results, null, 2),
        }],
      }
    },
  )

  mcpServer.tool(
    'find_references',
    'Find all locations where a symbol is used. Use instead of grep for symbol search.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    async ({ file, line, column }) => {
      const results = findReferences(svc, file, line, column)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(results, null, 2),
        }],
      }
    },
  )
}
