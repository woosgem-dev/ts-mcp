import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  external: ['typescript'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
