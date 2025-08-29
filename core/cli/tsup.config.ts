import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/cli/index.ts',
    'src/compiler/index.ts',
    'src/compiler/cache.ts',
    'src/compiler/transpiler.ts'
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false, // Keep false for easier debugging
  sourcemap: true,
  target: 'node18',
  // Only add shebang to CLI entry - use onSuccess instead
  onSuccess: async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    // Add shebang to CLI entry only
    const cliPath = path.join(process.cwd(), 'dist/cli/index.js');
    if (fs.existsSync(cliPath)) {
      const content = fs.readFileSync(cliPath, 'utf-8');
      if (!content.startsWith('#!')) {
        fs.writeFileSync(cliPath, '#!/usr/bin/env node\n' + content);
      }
    }
  },
  external: ['vite'],
  platform: 'node',
  splitting: true
})