import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
import type { ServiceProvider } from '../service/service-provider'
import { toLineColumn } from '../service/position-utils'
import { jsonResponse, errorResponse, noProjectResponse } from './response'

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
    const content = svc.readFileContent(fileName)

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
          if (!svc) return noProjectResponse(file)
          return jsonResponse(getDiagnostics(svc, file))
        }
        const allResults = provider.all().flatMap(svc => getDiagnostics(svc))
        return jsonResponse(allResults)
      } catch (error) {
        return errorResponse('diagnostics', error)
      }
    },
  )
}
