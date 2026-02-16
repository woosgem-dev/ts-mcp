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
  return svc.getSymbolIndexer().query(query)
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
    'Jump to the definition of a symbol at a given position. Requires file, line, and column. MUST use this instead of grep/ripgrep to find where a symbol is defined.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    { readOnlyHint: true },
    async ({ file, line, column }) => {
      try {
        const results = gotoDefinition(svc, file, line, column)
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(results, null, 2) },
            { type: 'text' as const, text: 'Next: Use find_references to find all usages, or get_type_info to inspect the type at this position.' },
          ],
        }
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: `goto_definition failed: ${error instanceof Error ? error.message : error}` }] }
      }
    },
  )

  mcpServer.tool(
    'find_references',
    'Find all usages of a symbol at a given position. Requires file, line, and column. MUST use this instead of grep/ripgrep to find where a symbol is used.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    { readOnlyHint: true },
    async ({ file, line, column }) => {
      try {
        const results = findReferences(svc, file, line, column)
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(results, null, 2) },
            { type: 'text' as const, text: 'Next: Use impact_analysis before modifying this symbol to assess blast radius.' },
          ],
        }
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: `find_references failed: ${error instanceof Error ? error.message : error}` }] }
      }
    },
  )

  mcpServer.tool(
    'workspace_symbols',
    'Find a symbol across the project by exact name (case-insensitive). MUST use this instead of grep/ripgrep to locate symbols. Returns all declarations matching that name with file and position.',
    {
      query: z.string().describe('Exact symbol name to find (e.g. "UserRepository", "createApp")'),
    },
    { readOnlyHint: true },
    async ({ query }) => {
      try {
        const results = workspaceSymbols(svc, query)
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(results, null, 2) },
            { type: 'text' as const, text: 'Next: Use goto_definition with file/line/column from these results to navigate to the source.' },
          ],
        }
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: `workspace_symbols failed: ${error instanceof Error ? error.message : error}` }] }
      }
    },
  )

  mcpServer.tool(
    'document_symbols',
    'List all symbols defined in a file. MUST use this instead of reading a file to understand its structure. Use to discover symbol names before calling other tools.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
    },
    { readOnlyHint: true },
    async ({ file }) => {
      try {
        const results = documentSymbols(svc, file)
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(results, null, 2) },
            { type: 'text' as const, text: 'Next: Use workspace_symbols with an exact symbol name to find it across the project, or goto_definition to jump to its source.' },
          ],
        }
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: `document_symbols failed: ${error instanceof Error ? error.message : error}` }] }
      }
    },
  )
}
