import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  target: 'node18',
  banner: {
    js: '#!/usr/bin/env node'
  },
  external: ['vite'],
  platform: 'node'
})