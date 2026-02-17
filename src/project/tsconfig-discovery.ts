import fs from 'node:fs'
import path from 'node:path'

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.next',
  'build',
  'coverage',
])

export function discoverTsConfigs(
  workspace: string,
  maxDepth = 3,
): string[] {
  const results: string[] = []
  scan(workspace, 0, maxDepth, results)
  return results.sort()
}

function scan(
  dir: string,
  depth: number,
  maxDepth: number,
  results: string[],
): void {
  if (depth > maxDepth) return

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'tsconfig.json') {
      results.push(path.join(dir, entry.name))
    } else if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) {
      scan(path.join(dir, entry.name), depth + 1, maxDepth, results)
    }
  }
}
