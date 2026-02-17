import type { User } from './types'

export interface Validator {
  validate(input: unknown): boolean
}

export const userValidator: Validator = {
  validate(input: unknown): boolean {
    if (typeof input !== 'object' || input === null) return false
    const obj = input as Record<string, unknown>
    return typeof obj.id === 'string' && typeof obj.name === 'string'
  },
}

export function processUsers(users: User[]): string[] {
  const results: string[] = []
  for (const user of users) {
    const formatted = `${user.name} <${user.email}>`
    results.push(formatted)
  }
  const filtered = users.filter((u) => u.name.length > 0).map((u) => u.id)
  return [...results, ...filtered]
}
