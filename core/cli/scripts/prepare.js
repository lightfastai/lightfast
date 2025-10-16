#!/usr/bin/env node

import { existsSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cliRoot = path.resolve(__dirname, '..')
const distPath = path.join(cliRoot, 'dist')
const distIndexPath = path.join(distPath, 'index.js')

// Check if dist already exists and has the main entry file
if (existsSync(distIndexPath)) {
  console.log('✓ @lightfastai/cli already built (dist/index.js exists)')
  console.log('  Run "pnpm build" to rebuild if needed')
  process.exit(0)
}

console.log('📦 @lightfastai/cli not built yet, building now...')
console.log('   (This happens automatically on first install)\n')

try {
  // Run the full build
  execSync('node scripts/build-all.js', {
    cwd: cliRoot,
    stdio: 'inherit'
  })
  console.log('\n✅ CLI built successfully!')
} catch (error) {
  console.error('\n❌ Failed to build CLI during prepare')
  console.error('   This is not critical - you can build manually with: pnpm build')
  console.error('   Error:', error.message)
  // Don't exit with error - allow install to continue
  process.exit(0)
}
