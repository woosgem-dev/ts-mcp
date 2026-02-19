import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import type { ServiceProvider } from '../service/service-provider'
import { toLineColumn } from '../service/position-utils'
import { extractJsDoc } from '../service/jsdoc-parser'
import { textContent, jsonResponse, errorResponse, noProjectResponse } from './response'

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
    signatures: help.items.map((item) => {
      const parts: Array<{ text: string }> = [...item.prefixDisplayParts]
      item.parameters.forEach((param, i) => {
        if (i > 0) parts.push(...item.separatorDisplayParts)
        parts.push(...param.displayParts)
      })
      parts.push(...item.suffixDisplayParts)
      return {
        label: parts.map(p => p.text).join(''),
        documentation: item.documentation.map(d => d.text).join('\n'),
        parameters: item.parameters.map((p) => ({
          name: p.displayParts.map(d => d.text).join(''),
          documentation: p.documentation.map(d => d.text).join('\n'),
        })),
      }
    }),
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
      const fileContent = svc.readFileContent(loc.fileName)
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

export interface MemberResult {
  name: string
  kind: string
  type: string
}

export function listMembers(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): MemberResult[] | undefined {
  const members = svc.getMembers(file, line, column)
  if (!members || members.length === 0) return undefined
  return members
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
        if (!svc) return noProjectResponse(file)
        const result = getTypeInfo(svc, file, line, column)
        if (!result) {
          return { content: [textContent('No type information at this position.')] }
        }
        return jsonResponse(result)
      } catch (error) {
        return errorResponse('get_type_info', error)
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
        if (!svc) return noProjectResponse(file)
        const result = signatureHelp(svc, file, line, column)
        if (!result) {
          return { content: [textContent('No signature help at this position.')] }
        }
        return jsonResponse(result)
      } catch (error) {
        return errorResponse('signature_help', error)
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
        if (!svc) return noProjectResponse(file)
        const result = renameSymbol(svc, file, line, column, newName)
        return jsonResponse(result, 'Apply all the file changes listed above. Run diagnostics after applying to verify no errors were introduced.')
      } catch (error) {
        return errorResponse('rename_symbol', error)
      }
    },
  )

  mcpServer.tool(
    'list_members',
    'List all properties and methods of the type at a given position. Use to discover what members an object or type has. Requires file, line, column. Next step: use get_type_info on a specific member for details.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
    },
    { readOnlyHint: true },
    async ({ file, line, column }) => {
      try {
        const svc = provider.forFile(file)
        if (!svc) return noProjectResponse(file)
        const result = listMembers(svc, file, line, column)
        if (!result) {
          return { content: [textContent('No members found at this position.')] }
        }
        const text = result
          .map((m) => `${m.kind === 'method' ? '(method)' : '(property)'} ${m.name}: ${m.type}`)
          .join('\n')
        return { content: [textContent(text)] }
      } catch (error) {
        return errorResponse('list_members', error)
      }
    },
  )
}
