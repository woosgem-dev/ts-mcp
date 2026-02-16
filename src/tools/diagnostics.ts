import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { TsMcpLanguageService } from '../service/language-service'
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
  const files = file ? [svc.resolveFileName(file)] : svc.getProjectFiles()
  const results: DiagnosticResult[] = []

  for (const fileName of files) {
    const content = svc.getFileContent(fileName) || ts.sys.readFile(fileName) || ''
    const syntactic = service.getSyntacticDiagnostics(fileName)
    const semantic = service.getSemanticDiagnostics(fileName)
    const suggestions = service.getSuggestionDiagnostics(fileName)

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

    for (const d of syntactic) {
      const r = mapDiag(d, 'error')
      if (r) results.push(r)
    }
    for (const d of semantic) {
      const severity = d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning'
      const r = mapDiag(d, severity)
      if (r) results.push(r)
    }
    for (const d of suggestions) {
      const r = mapDiag(d, 'suggestion')
      if (r) results.push(r)
    }
  }

  return results
}

export function registerDiagnosticsTools(
  mcpServer: McpServer,
  svc: TsMcpLanguageService,
): void {
  mcpServer.tool(
    'diagnostics',
    'Get TypeScript errors and warnings without running tsc. Works on a single file or entire project.',
    {
      file: z.string().optional().describe('File path (omit for all files)'),
    },
    async ({ file }) => {
      const results = getDiagnostics(svc, file)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
      }
    },
  )
}
