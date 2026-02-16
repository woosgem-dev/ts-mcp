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

export interface SymbolResult {
  name: string
  kind: string
  file: string
  line: number
  column: number
}

export function workspaceSymbols(
  svc: TsMcpLanguageService,
  query: string,
): SymbolResult[] {
  const ts = svc.getTs()
  const items = svc.getRawService().getNavigateToItems(query)
  return items.map((item) => {
    const content = svc.getFileContent(item.fileName) || ts.sys.readFile(item.fileName) || ''
    const loc = toLineColumn(content, item.textSpan.start)
    return {
      name: item.name,
      kind: ts.ScriptElementKind[item.kind as keyof typeof ts.ScriptElementKind] ?? item.kind,
      file: item.fileName,
      line: loc.line,
      column: loc.column,
    }
  })
}

export function documentSymbols(
  svc: TsMcpLanguageService,
  file: string,
): SymbolResult[] {
  const ts = svc.getTs()
  const fileName = svc.resolveFileName(file)
  const items = svc.getRawService().getNavigationBarItems(fileName)
  const content = svc.getFileContent(fileName)
  const results: SymbolResult[] = []

  function flatten(items: typeof ts.NavigationBarItem extends never ? any[] : any[]) {
    for (const item of items) {
      if (item.text === '<global>') {
        flatten(item.childItems)
        continue
      }
      const loc = toLineColumn(content, item.spans[0].start)
      results.push({
        name: item.text,
        kind: item.kind,
        file: fileName,
        line: loc.line,
        column: loc.column,
      })
      if (item.childItems) flatten(item.childItems)
    }
  }

  flatten(items)
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

  mcpServer.tool(
    'workspace_symbols',
    'Search for symbols across the entire project by name.',
    {
      query: z.string().describe('Symbol name or pattern to search'),
    },
    async ({ query }) => {
      const results = workspaceSymbols(svc, query)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
      }
    },
  )

  mcpServer.tool(
    'document_symbols',
    'List all symbols in a file (outline). Understand file structure without reading it.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
    },
    async ({ file }) => {
      const results = documentSymbols(svc, file)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
      }
    },
  )
}
