#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cliRoot = path.resolve(__dirname, '..')
const compilerPath = path.resolve(cliRoot, '../compiler')
const cloudClientPath = path.resolve(cliRoot, '../cloud-client')
const devServerPath = path.resolve(cliRoot, '../dev-server')

console.log('🚀 Building @lightfastai/cli with all dependencies...\n')

// Clean previous builds for fresh rebuilds
console.log('🧹 Cleaning previous builds...')
const cleanPaths = [
  path.join(compilerPath, 'dist'),
  path.join(cloudClientPath, 'dist'),
  path.join(devServerPath, '.output'),
  path.join(cliRoot, 'dist')
]

cleanPaths.forEach(p => {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
    console.log(`   Removed ${path.basename(path.dirname(p))}/${path.basename(p)}`)
  }
})
console.log('')

// Step 1: Build compiler (no workspace dependencies)
console.log('🔨 Building @lightfastai/compiler...')
try {
  execSync('pnpm build', {
    cwd: compilerPath,
    stdio: 'inherit'
  })
  console.log('✅ Compiler built successfully\n')
} catch (error) {
  console.error('❌ Failed to build compiler:', error.message)
  process.exit(1)
}

// Step 2: Build cloud-client (used by cli-core commands)
console.log('🔨 Building @lightfastai/cloud-client...')
try {
  execSync('pnpm build', {
    cwd: cloudClientPath,
    stdio: 'inherit'
  })
  console.log('✅ Cloud-client built successfully\n')
} catch (error) {
  console.error('❌ Failed to build cloud-client:', error.message)
  process.exit(1)
}

// Step 3: Build dev-server
// Note: cli-core is bundled directly from source by the CLI, no separate build needed
console.log('🔨 Building @lightfastai/dev-server...')
try {
  execSync('pnpm build', {
    cwd: devServerPath,
    stdio: 'inherit'
  })
  console.log('✅ Dev-server built successfully\n')
} catch (error) {
  console.error('❌ Failed to build dev-server:', error.message)
  process.exit(1)
}

// Step 4: Build CLI (which will bundle everything including cli-core from source)
console.log('🔨 Building @lightfastai/cli...')
try {
  execSync('pnpm build:bundle', {
    cwd: cliRoot,
    stdio: 'inherit'
  })
  console.log('\n✅ All packages built successfully!')
} catch (error) {
  console.error('❌ Failed to build CLI:', error.message)
  process.exit(1)
}