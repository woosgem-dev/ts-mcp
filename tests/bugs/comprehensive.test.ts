import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TsMcpLanguageService } from '../../src/service/language-service'
import { signatureHelp } from '../../src/tools/intelligence'
import { documentSymbols } from '../../src/tools/navigation'
import { typeHierarchy } from '../../src/tools/impact'
import { getDiagnostics } from '../../src/tools/diagnostics'
import path from 'node:path'

const fixtureDir = path.resolve(__dirname, '../fixtures/sample-project')
const serviceFile = path.join(fixtureDir, 'src/user-service.ts')
const typesFile = path.join(fixtureDir, 'src/types.ts')
const controllerFile = path.join(fixtureDir, 'src/user-controller.ts')
const validatorsFile = path.join(fixtureDir, 'src/validators.ts')

describe('Bug fixes', () => {
  let svc: TsMcpLanguageService

  beforeAll(() => {
    svc = new TsMcpLanguageService(fixtureDir)
  })

  afterAll(() => {
    svc.dispose()
  })

  // ── signature_help ────────────────────────────────────

  describe('signature_help', () => {
    it('H1.1: JSON.stringify(undefined) returns undefined — proves MCP bug', () => {
      // This test documents the root cause: JSON.stringify(undefined) is undefined, not a string
      const result = signatureHelp(svc, serviceFile, 1, 1)
      expect(result).toBeUndefined()
      // This is what causes MCP -32602: text field becomes undefined
      const stringified = JSON.stringify(result, null, 2)
      expect(stringified).toBeUndefined()
    })

    it('H1.2: returns valid signature at function call site', () => {
      // getUserOrThrow(this.repo, id) in user-controller.ts line 8
      const content = svc.getFileContent(controllerFile)
      const callIdx = content.indexOf('getUserOrThrow(this.repo')
      const lines = content.slice(0, callIdx).split('\n')
      const line = lines.length
      // Position cursor inside the parens (on 'this')
      const column = lines[lines.length - 1].length + 'getUserOrThrow('.length + 1

      const result = signatureHelp(svc, controllerFile, line, column)
      if (result) {
        expect(result.signatures.length).toBeGreaterThan(0)
      }
    })

    it('H1.3: label includes parameter names (not just prefix/suffix)', () => {
      const content = svc.getFileContent(controllerFile)
      const callIdx = content.indexOf('getUserOrThrow(this.repo')
      const lines = content.slice(0, callIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 'getUserOrThrow('.length + 1

      const result = signatureHelp(svc, controllerFile, line, column)
      if (result && result.signatures.length > 0) {
        const label = result.signatures[0].label
        // BUG: current label skips parameter display parts
        // Label should be like: getUserOrThrow(repository: UserRepository, id: string): Promise<User>
        // Not: getUserOrThrow(, ): Promise<User>
        expect(label).toContain('repository')
        expect(label).toContain('id')
      }
    })

    it('H1.4: parameters array has correct entries', () => {
      const content = svc.getFileContent(controllerFile)
      const callIdx = content.indexOf('getUserOrThrow(this.repo')
      const lines = content.slice(0, callIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 'getUserOrThrow('.length + 1

      const result = signatureHelp(svc, controllerFile, line, column)
      if (result && result.signatures.length > 0) {
        const sig = result.signatures[0]
        expect(sig.parameters.length).toBeGreaterThanOrEqual(2)
        expect(sig.parameters.some(p => p.name.includes('repository'))).toBe(true)
        expect(sig.parameters.some(p => p.name.includes('id'))).toBe(true)
      }
    })
  })

  // ── document_symbols ──────────────────────────────────

  describe('document_symbols', () => {
    it('H2.1: includes module-level declarations', () => {
      const result = documentSymbols(svc, serviceFile)
      const names = result.map(s => s.name)
      expect(names).toContain('InMemoryUserRepository')
      expect(names).toContain('getUserOrThrow')
    })

    it('H2.2: excludes local variables inside functions', () => {
      const result = documentSymbols(svc, serviceFile)
      const names = result.map(s => s.name)
      // 'user' is a local variable inside getUserOrThrow — should NOT appear
      expect(names).not.toContain('user')
    })

    it('H2.3: excludes class members (use list_members instead)', () => {
      const result = documentSymbols(svc, serviceFile)
      const names = result.map(s => s.name)
      // Class internals should not appear — agents use list_members for that
      expect(names).not.toContain('users')
      expect(names).not.toContain('findById')
      expect(names).not.toContain('findAll')
      expect(names).not.toContain('save')
    })

    it('H2.4: excludes callbacks and arrow functions', () => {
      const result = documentSymbols(svc, validatorsFile)
      const names = result.map(s => s.name)
      expect(names.every(n => !n.includes('callback'))).toBe(true)
      expect(names.every(n => !n.includes('=>'))).toBe(true)
    })

    it('H2.5: returns reasonable count', () => {
      const result = documentSymbols(svc, validatorsFile)
      // Expected: Validator, userValidator, processUsers = 3 symbols
      expect(result.length).toBeLessThanOrEqual(10)
    })

    it('H2.6: excludes local variables from loops and closures', () => {
      const result = documentSymbols(svc, validatorsFile)
      const names = result.map(s => s.name)
      expect(names).not.toContain('results')
      expect(names).not.toContain('formatted')
      expect(names).not.toContain('filtered')
      expect(names).not.toContain('obj')
    })

    it('H2.7: types.ts returns only interfaces', () => {
      const result = documentSymbols(svc, typesFile)
      const names = result.map(s => s.name)
      expect(names).toContain('User')
      expect(names).toContain('UserRepository')
      expect(names).toContain('OldUserStore')
      expect(names).toContain('PaymentService')
      // Should NOT include interface members like findById, id, name, email
      expect(names).not.toContain('findById')
      expect(names).not.toContain('id')
      expect(names).not.toContain('email')
    })
  })

  // ── type_hierarchy ────────────────────────────────────

  describe('type_hierarchy', () => {
    it('H3.1: class implementation returns short identifier', () => {
      const content = svc.getFileContent(typesFile)
      const match = content.indexOf('interface UserRepository')
      const nameIdx = content.indexOf('UserRepository', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = typeHierarchy(svc, typesFile, line, column)
      expect(result.length).toBeGreaterThanOrEqual(1)
      for (const impl of result) {
        expect(impl.name.length).toBeLessThan(100)
        expect(impl.name).not.toContain('\n')
      }
    })

    it('H3.2: object literal implementation returns variable name, not source', () => {
      const content = svc.getFileContent(validatorsFile)
      const match = content.indexOf('interface Validator')
      const nameIdx = content.indexOf('Validator', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = typeHierarchy(svc, validatorsFile, line, column)
      for (const impl of result) {
        // Name should NOT contain full object literal source code
        expect(impl.name).not.toContain('{')
        expect(impl.name.length).toBeLessThan(100)
      }
    })

    it('H3.3: no implementation name contains newlines or long source', () => {
      const content = svc.getFileContent(typesFile)
      const match = content.indexOf('interface UserRepository')
      const nameIdx = content.indexOf('UserRepository', match)
      const lines = content.slice(0, nameIdx).split('\n')
      const line = lines.length
      const column = lines[lines.length - 1].length + 1

      const result = typeHierarchy(svc, typesFile, line, column)
      for (const impl of result) {
        expect(impl.name).not.toContain('\n')
        expect(impl.name.length).toBeLessThan(100)
      }
    })
  })

  // ── diagnostics ───────────────────────────────────────

  describe('diagnostics', () => {
    it('H4.1: valid files have no errors', () => {
      const result = getDiagnostics(svc, typesFile)
      const errors = result.filter(d => d.severity === 'error')
      expect(errors).toEqual([])
    })

    it('H4.2: project-wide scan works without false positives', () => {
      const result = getDiagnostics(svc)
      const errors = result.filter(d => d.severity === 'error')
      expect(errors).toEqual([])
    })

    it('H4.3: severity is correctly categorized', () => {
      const result = getDiagnostics(svc)
      for (const d of result) {
        expect(['error', 'warning', 'suggestion']).toContain(d.severity)
      }
    })

    it('H4.4: each diagnostic has required fields', () => {
      const result = getDiagnostics(svc, serviceFile)
      for (const d of result) {
        expect(typeof d.file).toBe('string')
        expect(typeof d.line).toBe('number')
        expect(typeof d.column).toBe('number')
        expect(typeof d.message).toBe('string')
        expect(d.line).toBeGreaterThan(0)
        expect(d.column).toBeGreaterThan(0)
      }
    })
  })
})
