# @lightfastai/cli

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@lightfastai/cli.svg)](https://www.npmjs.com/package/@lightfastai/cli)
[![GitHub issues](https://img.shields.io/github/issues/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/issues)

The official command-line interface for the Lightfast agent execution engine. A single, self-contained package that bundles everything needed to develop, test, and manage AI agents.

## About

The Lightfast CLI provides a complete development environment for building AI agents. It's published as a single npm package that includes:

- 🎯 **All-in-One Package**: Bundled CLI, compiler, and dev server in one installation
- 🎨 **Web UI**: Beautiful interface powered by TanStack Start and React 19
- ⚡ **Hot Reload**: Live updates for configuration changes
- 📦 **Zero Config**: Works out of the box with sensible defaults
- 🔨 **TypeScript Support**: Full compilation and type checking built-in

## Installation

```bash
# Install globally
npm install -g @lightfastai/cli

# Or use directly with npx (recommended)
npx @lightfastai/cli dev

# Or with pnpm
pnpm add -g @lightfastai/cli
```

## Quick Start

```bash
# Start development server
npx @lightfastai/cli dev

# Start on custom port
npx @lightfastai/cli dev --port 3001

# Compile TypeScript configuration
npx @lightfastai/cli compile

# Clean build artifacts
npx @lightfastai/cli clean
```

## Commands

### `dev`
Start the Lightfast development server with hot-reload for configuration changes.

**Options:**
- `-p, --port <port>` - Port to run server on (default: 3000)
- `-h, --host <host>` - Host to bind to (default: localhost)
- `--no-watch` - Disable file watching for config changes
- `--no-compile` - Skip TypeScript compilation

**Examples:**
```bash
# Default settings
npx @lightfastai/cli dev

# Custom port
npx @lightfastai/cli dev --port 8080

# Network accessible
npx @lightfastai/cli dev --host 0.0.0.0
```

### `compile`
Compile TypeScript configuration files to JavaScript.

**Options:**
- `-w, --watch` - Watch mode for continuous compilation
- `-c, --config <path>` - Path to config file (default: lightfast.config.ts)
- `-o, --output <path>` - Output directory (default: .lightfast)

**Examples:**
```bash
# One-time compilation
npx @lightfastai/cli compile

# Watch mode
npx @lightfastai/cli compile --watch

# Custom config path
npx @lightfastai/cli compile --config src/agents.config.ts
```

### `clean`
Remove build artifacts and caches.

**Options:**
- `-c, --cache` - Clean cache only
- `-b, --build` - Clean build output only
- `-a, --all` - Clean everything

**Examples:**
```bash
# Clean everything
npx @lightfastai/cli clean

# Clean cache only
npx @lightfastai/cli clean --cache
```

## Project Configuration

Create a `lightfast.config.ts` file in your project root:

```typescript
import { createLightfast } from 'lightfast'
import { createAgent } from 'lightfast/agent'

const myAgent = createAgent({
  name: 'my-agent',
  system: 'You are a helpful assistant',
  model: 'claude-3-5-sonnet'
})

export default createLightfast({
  agents: { myAgent },
  metadata: {
    name: 'My Lightfast Project',
    version: '1.0.0'
  }
})
```

### Package.json Scripts

Add to your project's `package.json`:

```json
{
  "scripts": {
    "dev": "cli dev",
    "compile": "cli compile",
    "clean": "cli clean"
  },
  "dependencies": {
    "@lightfastai/cli": "^0.2.1",
    "lightfast": "^0.1.0"
  }
}
```

## Architecture

The CLI is distributed as a single npm package containing:

### Package Structure
```
@lightfastai/cli/
├── dist/
│   ├── index.js              # Bundled CLI (54KB)
│   ├── index.d.ts            # TypeScript definitions
│   └── dev-server-output/    # Pre-built UI assets
│       ├── public/           # Client assets
│       └── server/           # Server rendering
└── package.json              # Runtime dependencies
```

### What's Included
- **Bundled JavaScript** (54KB): All CLI logic, compiler, and core functionality
- **Pre-built Dev Server**: Production-ready React UI
- **Minimal Dependencies**: Only essential runtime packages (commander, chalk, etc.)

Total installed size: ~1MB

## Development

### Prerequisites
- Node.js >= 18
- pnpm 10.5.2 (for development)

### Building from Source

```bash
# Clone repository
git clone https://github.com/lightfastai/lightfast.git
cd lightfast/core/cli

# Install dependencies
pnpm install

# Full build (builds all dependencies)
pnpm build
# This runs:
# 1. Build @lightfastai/compiler
# 2. Build @lightfastai/cli-core
# 3. Build @lightfastai/dev-server
# 4. Bundle everything into CLI

# Quick rebuild (if deps already built)
pnpm build:quick

# Development mode
pnpm dev
```

### Testing Locally

```bash
# After building
node dist/index.js --help

# Test with example project
cd ../../examples/1-agent-chat
node ../../core/cli/dist/index.js dev

# Or link globally
pnpm link --global
cli dev
```

### Build Pipeline

The build process (`scripts/build-all.js`) ensures proper build order:

1. **Clean**: Remove all previous builds
2. **Compiler**: Build TypeScript compiler package
3. **CLI-Core**: Build core CLI logic
4. **Dev-Server**: Build React UI with Vite
5. **Bundle**: Package everything into dist/

### Publishing

Only the CLI package is published to npm:

```bash
# Build everything
pnpm build

# Check package contents
npm pack --dry-run

# Publish with changeset
pnpm changeset
pnpm changeset version
pnpm changeset publish
```

## Troubleshooting

### Common Issues

**Dev server not starting**
```bash
# Rebuild all dependencies
pnpm build
```

**Module not found errors**
```bash
# Force reinstall and rebuild
pnpm install --force
pnpm build
```

**Permission denied**
```bash
chmod +x dist/index.js
```

### Debug Mode

Run with debug output:
```bash
DEBUG=1 npx @lightfastai/cli dev
```

## Requirements

- **Node.js**: >= 18.0.0
- **OS**: macOS, Linux, or Windows
- **Memory**: 512MB minimum
- **Disk**: 100MB for installation

## Support

- **Documentation**: [lightfast.ai/docs](https://lightfast.ai/docs)
- **GitHub Issues**: [github.com/lightfastai/lightfast/issues](https://github.com/lightfastai/lightfast/issues)
- **Discord**: [discord.gg/lightfast](https://discord.gg/lightfast)

## License

MIT © Lightfast

---

**Part of the [Lightfast](https://github.com/lightfastai/lightfast) ecosystem**