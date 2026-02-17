import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import type { ServiceProvider } from '../service/service-provider'
import { toLineColumn } from '../service/position-utils'

export interface DiagnosticResult {
  file: string
  line: number
  column: number
  message: string
  code: number | undefined
  severity: 'error' | 'warning' | 'suggestion'
}

export function getDiagnostics(
  svc: TsMcpLanguageService,
  file?: string,
): DiagnosticResult[] {
  const ts = svc.getTs()
  const service = svc.getRawService()
  const singleFile = file != null
  const files = singleFile ? [svc.resolveFileName(file)] : svc.getProjectFiles()
  const results: DiagnosticResult[] = []

  for (const fileName of files) {
    const content = svc.getFileContent(fileName) || ts.sys.readFile(fileName) || ''

    const mapDiag = (
      diag: import('typescript').Diagnostic,
      severity: DiagnosticResult['severity'],
    ): DiagnosticResult | undefined => {
      if (diag.start === undefined) return undefined
      const loc = toLineColumn(content, diag.start)
      return {
        file: fileName,
        line: loc.line,
        column: loc.column,
        message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
        code: diag.code,
        severity,
      }
    }

    for (const d of service.getSyntacticDiagnostics(fileName)) {
      const r = mapDiag(d, 'error')
      if (r) results.push(r)
    }
    for (const d of service.getSemanticDiagnostics(fileName)) {
      const severity = d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning'
      const r = mapDiag(d, severity)
      if (r) results.push(r)
    }
    // Skip suggestions for project-wide scans (expensive + noisy for agents)
    if (singleFile) {
      for (const d of service.getSuggestionDiagnostics(fileName)) {
        const r = mapDiag(d, 'suggestion')
        if (r) results.push(r)
      }
    }
  }

  return results
}

export function registerDiagnosticsTools(
  mcpServer: McpServer,
  provider: ServiceProvider,
): void {
  mcpServer.tool(
    'diagnostics',
    'Get TypeScript errors and warnings. Pass a file for single-file check, or omit for the entire project.',
    {
      file: z.string().optional().describe('File path (omit for all files)'),
    },
    { readOnlyHint: true },
    async ({ file }) => {
      try {
        if (file) {
          const svc = provider.forFile(file)
          if (!svc) {
            return { content: [{ type: 'text' as const, text: `No project found for file: ${file}` }], isError: true }
          }
          const results = getDiagnostics(svc, file)
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
          }
        } else {
          const allResults = provider.all().flatMap(svc => getDiagnostics(svc))
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(allResults, null, 2) }],
          }
        }
      } catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: `diagnostics failed: ${error instanceof Error ? error.message : error}` }] }
      }
    },
  )
}
