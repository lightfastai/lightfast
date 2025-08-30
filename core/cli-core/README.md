# @lightfastai/cli-core

Core command logic and orchestration for the Lightfast CLI. This package contains all CLI commands and utilities that power the Lightfast development experience.

## Overview

This package is the brain of the Lightfast CLI, providing:

- 🎯 **Command Implementation**: All CLI commands (dev, compile, clean)
- 🔧 **Compiler Integration**: TypeScript compilation orchestration
- 🌐 **Server Management**: Development server lifecycle
- 📊 **Configuration Handling**: Config file discovery and validation

## Architecture

```
cli-core/
├── src/
│   ├── commands/          # CLI command implementations
│   │   ├── dev.ts        # Development server command
│   │   ├── compile.ts    # TypeScript compilation command
│   │   └── clean.ts      # Cleanup command
│   ├── utils/            # Shared utilities
│   │   └── package.ts    # Package info utilities
│   └── index.ts          # Main entry point
├── dist/                 # Compiled output
├── package.json
└── tsup.config.ts        # Build configuration
```

## Commands

### `dev` Command

Starts the development server with hot-reload capabilities.

```typescript
// src/commands/dev.ts
- Compiles TypeScript configuration
- Starts file watcher for changes
- Launches dev-server UI
- Manages server lifecycle
```

**Options:**
- `--port <port>` - Server port (default: 3000)
- `--host <host>` - Bind host (default: localhost)
- `--no-watch` - Disable file watching
- `--no-compile` - Skip TypeScript compilation

### `compile` Command

Compiles TypeScript configuration files.

```typescript
// src/commands/compile.ts
- Discovers configuration files
- Transpiles TypeScript to JavaScript
- Caches compilation results
- Reports errors with formatting
```

**Options:**
- `--watch` - Watch mode
- `--config <path>` - Config file path
- `--output <path>` - Output directory

### `clean` Command

Removes build artifacts and caches.

```typescript
// src/commands/clean.ts
- Cleans .lightfast directory
- Removes compilation cache
- Clears build outputs
```

**Options:**
- `--cache` - Clean cache only
- `--build` - Clean build only
- `--all` - Clean everything

## Dependencies

This package depends on:

- `@lightfastai/compiler` - TypeScript compilation engine
- `@lightfastai/dev-server` - Development UI server
- `commander` - CLI framework
- `chalk` - Terminal styling

## Development

### Building

```bash
# Build the package
pnpm build

# Watch mode
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Testing

```bash
# Test commands directly
node dist/index.js --help
```

## API Usage

While this package is primarily used internally by the CLI, it can be imported programmatically:

```typescript
import { devCommand, compileCommand, cleanCommand } from '@lightfastai/cli-core'
import { Command } from 'commander'

const program = new Command()
program.addCommand(devCommand)
program.addCommand(compileCommand)
program.addCommand(cleanCommand)
program.parse()
```

## Implementation Details

### Dev Server Detection

The dev command detects whether it's running in production or development:

```typescript
const isProduction = __dirname.includes('/dist')

if (isProduction) {
  // Use bundled dev-server output
  const bundledServer = path.resolve(__dirname, 'dev-server-output/server/index.mjs')
} else {
  // Use workspace dev-server
  const devServerPath = path.resolve(__dirname, '../dev-server')
}
```

### Configuration Discovery

Automatically finds configuration files:

```typescript
const configPaths = [
  'lightfast.config.ts',
  'lightfast.config.js',
  '.lightfast/config.js'
]
```

### Error Handling

Comprehensive error handling with formatted output:

```typescript
try {
  const result = await compiler.compile()
  if (result.errors.length > 0) {
    console.error(formatCompilationErrors(result.errors))
  }
} catch (error) {
  console.error(chalk.red('✖ Compilation failed:'), error)
}
```

## File Structure

```
cli-core/
├── src/
│   ├── commands/
│   │   ├── dev.ts         # ~250 lines - Dev server orchestration
│   │   ├── compile.ts     # ~150 lines - Compilation logic
│   │   └── clean.ts       # ~80 lines - Cleanup utilities
│   ├── utils/
│   │   └── package.ts     # ~30 lines - Package info
│   └── index.ts          # ~40 lines - CLI setup
├── dist/
│   ├── index.js          # ~16KB bundled
│   └── index.d.ts        # Type definitions
└── package.json
```

## Build Configuration

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node'
  }
})
```

## Publishing

This package is **not published to npm**. It's bundled into `@lightfastai/cli` during the CLI build process.

## Contributing

When modifying this package:

1. Make changes in `src/`
2. Run `pnpm build` in the CLI package (rebuilds everything)
3. Test with `node ../../cli/dist/index.js <command>`
4. Ensure all commands work correctly

## License

MIT © Lightfast

---

Part of the [Lightfast](https://github.com/lightfastai/lightfast) monorepo