import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import type { ServiceProvider } from '../service/service-provider'
import { toLineColumn } from '../service/position-utils'
import { extractJsDoc } from '../service/jsdoc-parser'

export interface TypeInfoResult {
  displayString: string
  documentation: string
  kind: string
  jsdoc?: Record<string, any>
}

export interface SignatureHelpResult {
  signatures: Array<{
    label: string
    documentation: string
    parameters: Array<{ name: string; documentation: string }>
  }>
  activeSignature: number
  activeParameter: number
}

export function getTypeInfo(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): TypeInfoResult | undefined {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const info = svc.getRawService().getQuickInfoAtPosition(fileName, position)

  if (!info) return undefined

  const displayString = info.displayParts?.map(p => p.text).join('') ?? ''
  const documentation = info.documentation?.map(d => d.text).join('\n') ?? ''

  const jsdoc = info.tags ? extractJsDoc(info.tags) : undefined

  return {
    displayString,
    documentation,
    kind: info.kind,
    jsdoc,
  }
}

export function signatureHelp(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): SignatureHelpResult | undefined {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const help = svc.getRawService().getSignatureHelpItems(fileName, position, undefined)

  if (!help) return undefined

  return {
    signatures: help.items.map((item) => ({
      label: [...item.prefixDisplayParts, ...item.separatorDisplayParts, ...item.suffixDisplayParts]
        .map(p => p.text).join(''),
      documentation: item.documentation.map(d => d.text).join('\n'),
      parameters: item.parameters.map((p) => ({
        name: p.displayParts.map(d => d.text).join(''),
        documentation: p.documentation.map(d => d.text).join('\n'),
      })),
    })),
    activeSignature: help.selectedItemIndex,
    activeParameter: help.argumentIndex,
  }
}

export interface RenameResult {
  oldName: string
  newName: string
  locations: Array<{
    file: string
    line: number
    column: number
    text: string
  }>
}

export function renameSymbol(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
  newName: string,
): RenameResult {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const renameLocations = svc.getRawService().findRenameLocations(
    fileName,
    position,
    false,
    false,
  )

  const content = svc.getFileContent(fileName)
  const oldName = content.slice(position, position + (renameLocations?.[0]?.textSpan.length ?? 0))

  if (!renameLocations) {
    return { oldName, newName, locations: [] }
  }

  return {
    oldName,
    newName,
    locations: renameLocations.map((loc) => {
      const fileContent = svc.getFileContent(loc.fileName) || svc.getTs().sys.readFile(loc.fileName) || ''
      const locPos = toLineColumn(fileContent, loc.textSpan.start)
      const text = fileContent.slice(loc.textSpan.start, loc.textSpan.start + loc.textSpan.length)
      return {
        file: loc.fileName,
        line: locPos.line,
        column: locPos.column,
        text,
      }
    }),
  }
}

export function registerIntelligenceTools(
  mcpServer: McpServer,
  provider: ServiceProvider,
): void {
  mcpServer.tool(
    'get_type_info',
    'Get the resolved type, documentation, and JSDoc tags for a symbol at a given position.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    { readOnlyHint: true },
    async ({ file, line, column }) => {
      try {
        const svc = provider.forFile(file)
        if (!svc) {
          return { content: [{ type: 'text' as const, text: `No project found for file: ${file}` }], isError: true }
        }
        const result = getTypeInfo(svc, file, line, column)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: `get_type_info failed: ${error instanceof Error ? error.message : error}` }] }
      }
    },
  )

  mcpServer.tool(
    'signature_help',
    'Get parameter names, types, and overloads for a function call at a given position.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    { readOnlyHint: true },
    async ({ file, line, column }) => {
      try {
        const svc = provider.forFile(file)
        if (!svc) {
          return { content: [{ type: 'text' as const, text: `No project found for file: ${file}` }], isError: true }
        }
        const result = signatureHelp(svc, file, line, column)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: `signature_help failed: ${error instanceof Error ? error.message : error}` }] }
      }
    },
  )

  mcpServer.tool(
    'rename_symbol',
    'Compute all edits needed to rename a symbol. Returns file paths and text changes to apply.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
      newName: z.string().describe('New name for the symbol'),
    },
    { readOnlyHint: true },
    async ({ file, line, column, newName }) => {
      try {
        const svc = provider.forFile(file)
        if (!svc) {
          return { content: [{ type: 'text' as const, text: `No project found for file: ${file}` }], isError: true }
        }
        const result = renameSymbol(svc, file, line, column, newName)
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) },
            { type: 'text' as const, text: 'Apply all the file changes listed above. Run diagnostics after applying to verify no errors were introduced.' },
          ],
        }
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: `rename_symbol failed: ${error instanceof Error ? error.message : error}` }] }
      }
    },
  )
}
