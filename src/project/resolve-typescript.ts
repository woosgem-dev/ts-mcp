import { createRequire } from 'node:module'
import type ts from 'typescript'

export function resolveTypeScript(workspace: string): typeof ts {
  try {
    const req = createRequire(workspace + '/package.json')
    return req('typescript')
  } catch {
    const req = createRequire(import.meta.url)
    return req('typescript')
  }
}
