import { defineConfig } from 'tsup'
import { cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: false,
  target: 'node18',
  // Bundle all our workspace packages and their dependencies
  noExternal: [
    '@lightfastai/cli-core',
    '@lightfastai/compiler',
    /^\.\.\//, // Bundle relative imports from cli-core
  ],
  // Keep dev-server external (we copy its output separately)
  // Also keep native modules external
  external: [
    '@lightfastai/dev-server',
    'keytar', // Native module for secure credential storage
    '@inquirer/prompts', // Has native dependencies
    'typescript' // TypeScript Compiler API needs to be external
  ],
  async onSuccess() {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    // Add shebang to main entry
    const entryPath = path.join(process.cwd(), 'dist/index.js');
    if (fs.existsSync(entryPath)) {
      const content = fs.readFileSync(entryPath, 'utf-8');
      if (!content.startsWith('#!')) {
        fs.writeFileSync(entryPath, '#!/usr/bin/env node\n' + content);
      }
    }
    
    // Copy the dev-server output (should already be built by build-all.js)
    const devServerPath = path.resolve(process.cwd(), '../dev-server');
    const devServerOutput = path.resolve(devServerPath, '.output');
    const targetOutput = path.resolve(process.cwd(), 'dist/dev-server-output');
    
    if (!existsSync(devServerOutput)) {
      console.error('❌ Dev-server output not found at', devServerOutput);
      console.error('   Please run "pnpm build" which builds all dependencies.');
      process.exit(1);
    }
    
    console.log('📦 Copying dev-server output...');
    await cp(devServerOutput, targetOutput, { 
      recursive: true,
      filter: (source) => {
        // Exclude node_modules directory from the copy
        return !source.includes('node_modules');
      }
    });
    console.log('✅ Dev-server output copied to dist/dev-server-output (without node_modules)');
  },
  platform: 'node'
})