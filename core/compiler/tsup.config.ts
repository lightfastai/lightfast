import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cache.ts',
    'src/transpiler.ts',
    'src/watcher.ts',
    'src/error-formatter.ts'
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  target: 'node18',
  platform: 'node',
  splitting: true,
  external: []
})