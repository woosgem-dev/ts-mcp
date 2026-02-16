import type { TsMcpLanguageService } from './language-service'
import { findReferences } from '../tools/navigation'
import { callHierarchy, typeHierarchy } from '../tools/impact'

export interface ImpactResult {
  symbol: string
  file: string
  line: number
  column: number
  directReferences: number
  affectedFiles: string[]
  callers: Array<{ name: string; file: string; line: number }>
  implementations: Array<{ name: string; file: string; line: number }>
  risk: 'low' | 'medium' | 'high'
}

export function analyzeImpact(
  svc: TsMcpLanguageService,
  file: string,
  line: number,
  column: number,
): ImpactResult {
  const fileName = svc.resolveFileName(file)
  const position = svc.resolvePosition(fileName, line, column)

  const quickInfo = svc.getRawService().getQuickInfoAtPosition(fileName, position)
  const rawDisplay = quickInfo?.displayParts?.map(p => p.text).join('') ?? 'unknown'
  // Extract just the symbol name: remove keywords like "function", "class", etc. and signatures
  const symbolName = rawDisplay
    .replace(/^(function|class|interface|type|const|let|var|enum|namespace|module)\s+/, '')
    .split('(')[0]
    .split(':')[0]
    .split('<')[0]
    .trim()

  const refs = findReferences(svc, file, line, column)
  const affectedFiles = [...new Set(refs.map(r => r.file))]

  const callers = callHierarchy(svc, file, line, column, 'incoming')

  const impls = typeHierarchy(svc, file, line, column)

  const totalImpact = refs.length + callers.length + impls.length
  const risk: ImpactResult['risk'] =
    totalImpact >= 20 ? 'high' :
    totalImpact >= 5 ? 'medium' :
    'low'

  return {
    symbol: symbolName,
    file: fileName,
    line,
    column,
    directReferences: refs.length,
    affectedFiles,
    callers: callers.map(c => ({ name: c.from, file: c.fromFile, line: c.line })),
    implementations: impls.map(i => ({ name: i.name, file: i.file, line: i.line })),
    risk,
  }
}
