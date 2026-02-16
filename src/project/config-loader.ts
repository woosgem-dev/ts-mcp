import path from 'node:path'
import { createRequire } from 'node:module'
import type ts from 'typescript'

export interface TsConfig {
  options: ts.CompilerOptions
  fileNames: string[]
  errors: ts.Diagnostic[]
}

export function loadTsConfig(
  workspace: string,
  tsModule?: typeof ts,
): TsConfig {
  const tsLib = tsModule ?? (createRequire(import.meta.url)('typescript') as typeof ts)
  const configPath = tsLib.findConfigFile(
    workspace,
    tsLib.sys.fileExists,
    'tsconfig.json',
  )

  if (!configPath) {
    return {
      options: tsLib.getDefaultCompilerOptions(),
      fileNames: [],
      errors: [],
    }
  }

  const configFile = tsLib.readConfigFile(configPath, tsLib.sys.readFile)
  const parsed = tsLib.parseJsonConfigFileContent(
    configFile.config,
    tsLib.sys,
    path.dirname(configPath),
  )

  return {
    options: parsed.options,
    fileNames: parsed.fileNames,
    errors: parsed.errors,
  }
}
