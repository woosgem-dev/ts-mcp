import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import type { ServiceProvider } from '../service/service-provider'
import { toLineColumn } from '../service/position-utils'
import { analyzeImpact } from '../service/impact-analyzer'
import { jsonResponse, errorResponse, noProjectResponse } from './response'

export interface CallHierarchyResult {
  from: string
  fromFile: string
  line: number
  column: number
}

export function callHierarchy(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
  direction: 'incoming' | 'outgoing',
): CallHierarchyResult[] {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const service = svc.getRawService()

  const prepared = service.prepareCallHierarchy(fileName, position)
  if (!prepared) return []

  const items = Array.isArray(prepared) ? prepared : [prepared]
  const results: CallHierarchyResult[] = []

  for (const item of items) {
    const calls =
      direction === 'incoming'
        ? service.provideCallHierarchyIncomingCalls(item.file, item.selectionSpan.start)
        : service.provideCallHierarchyOutgoingCalls(item.file, item.selectionSpan.start)

    for (const call of calls) {
      const target = direction === 'incoming'
        ? (call as import('typescript').CallHierarchyIncomingCall).from
        : (call as import('typescript').CallHierarchyOutgoingCall).to
      const content = svc.readFileContent(target.file)
      const loc = toLineColumn(content, target.selectionSpan.start)
      results.push({
        from: target.name,
        fromFile: target.file,
        line: loc.line,
        column: loc.column,
      })
    }
  }

  return results
}

export interface TypeHierarchyResult {
  name: string
  file: string
  line: number
  column: number
  kind: string
}

export function typeHierarchy(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): TypeHierarchyResult[] {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)
  const implementations = svc.getRawService().getImplementationAtPosition(fileName, position)

  if (!implementations) return []

  return implementations.map((impl) => {
    const content = svc.readFileContent(impl.fileName)
    const loc = toLineColumn(content, impl.textSpan.start)
    const name = impl.displayParts?.map(p => p.text).join('') ??
      content.slice(impl.textSpan.start, impl.textSpan.start + impl.textSpan.length)
    return {
      name,
      file: impl.fileName,
      line: loc.line,
      column: loc.column,
      kind: impl.kind,
    }
  })
}

export function registerImpactTools(
  mcpServer: McpServer,
  provider: ServiceProvider,
): void {
  mcpServer.tool(
    'call_hierarchy',
    'Find callers (incoming) or callees (outgoing) of a function at a given position.',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
      direction: z.enum(['incoming', 'outgoing']).describe('Call direction'),
    },
    { readOnlyHint: true },
    async ({ file, line, column, direction }) => {
      try {
        const svc = provider.forFile(file)
        if (!svc) return noProjectResponse(file)
        const results = callHierarchy(svc, file, line, column, direction)
        return jsonResponse(results)
      } catch (error) {
        return errorResponse('call_hierarchy', error)
      }
    },
  )

  mcpServer.tool(
    'type_hierarchy',
    'Find all implementations of an interface or subclasses of a class at a given position.',
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
        const results = typeHierarchy(svc, file, line, column)
        return jsonResponse(results)
      } catch (error) {
        return errorResponse('type_hierarchy', error)
      }
    },
  )

  mcpServer.tool(
    'impact_analysis',
    'Assess blast radius before modifying a symbol. Returns references, callers, implementations, and risk level. MUST run this before any refactoring.',
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
        const result = analyzeImpact(svc, file, line, column)
        return jsonResponse(result)
      } catch (error) {
        return errorResponse('impact_analysis', error)
      }
    },
  )
}
