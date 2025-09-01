import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  target: 'node18',
  onSuccess: async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    // Add shebang to CLI entry
    const cliPath = path.join(process.cwd(), 'dist/index.js');
    if (fs.existsSync(cliPath)) {
      const content = fs.readFileSync(cliPath, 'utf-8');
      if (!content.startsWith('#!')) {
        fs.writeFileSync(cliPath, '#!/usr/bin/env node\n' + content);
      }
    }
  },
  platform: 'node',
  splitting: false
})