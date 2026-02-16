import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import { toLineColumn } from '../service/position-utils'

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
      if (direction === 'incoming') {
        const incoming = call as import('typescript').CallHierarchyIncomingCall
        const content = svc.getFileContent(incoming.from.file) || svc.getTs().sys.readFile(incoming.from.file) || ''
        const loc = toLineColumn(content, incoming.from.selectionSpan.start)
        results.push({
          from: incoming.from.name,
          fromFile: incoming.from.file,
          line: loc.line,
          column: loc.column,
        })
      } else {
        const outgoing = call as import('typescript').CallHierarchyOutgoingCall
        const content = svc.getFileContent(outgoing.to.file) || svc.getTs().sys.readFile(outgoing.to.file) || ''
        const loc = toLineColumn(content, outgoing.to.selectionSpan.start)
        results.push({
          from: outgoing.to.name,
          fromFile: outgoing.to.file,
          line: loc.line,
          column: loc.column,
        })
      }
    }
  }

  return results
}

export function registerImpactTools(
  mcpServer: McpServer,
  svc: TsMcpLanguageService,
): void {
  mcpServer.tool(
    'call_hierarchy',
    'Find incoming or outgoing calls for a function. Shows who calls this function (incoming) or what this function calls (outgoing).',
    {
      file: z.string().describe('Absolute or workspace-relative file path'),
      line: z.number().describe('1-based line number'),
      column: z.number().describe('1-based column number'),
      direction: z.enum(['incoming', 'outgoing']).describe('Call direction'),
    },
    async ({ file, line, column, direction }) => {
      const results = callHierarchy(svc, file, line, column, direction)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
      }
    },
  )
}
