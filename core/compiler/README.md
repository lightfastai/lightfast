# @lightfastai/compiler

[![CI Status](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40lightfastai%2Fcompiler.svg)](https://badge.fury.io/js/%40lightfastai%2Fcompiler)
[![Test Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen)](./coverage/index.html)

TypeScript compilation engine for Lightfast configuration files. Provides fast, cached compilation with hot-reload support using esbuild.

## Overview

The compiler package provides:

- ⚡ **Fast Compilation**: esbuild-powered TypeScript transpilation
- 💾 **Smart Caching**: File-based cache for instant rebuilds
- 🔄 **Hot Reload**: File watching with automatic recompilation
- 🎨 **Pretty Errors**: Formatted error output with code context
- 📦 **Bundling**: Automatic dependency resolution and bundling

## Features

### Fast TypeScript Compilation

Uses esbuild for lightning-fast TypeScript compilation:

```typescript
import { createCompiler } from '@lightfastai/compiler'

const compiler = createCompiler({
  entryPoint: 'lightfast.config.ts',
  outputPath: '.lightfast/',
  watch: false
})

const result = await compiler.compile()
```

### Intelligent Caching

Caches compilation results with hash-based invalidation:

```typescript
import { CompilationCache } from '@lightfastai/compiler/cache'

const cache = new CompilationCache('.lightfast/.cache')

// Check if cached version exists
if (await cache.has(configPath)) {
  const cached = await cache.get(configPath)
  if (cached && !cached.isStale) {
    return cached.output
  }
}
```

### File Watching

Built-in file watcher for development:

```typescript
import { createConfigWatcher } from '@lightfastai/compiler/watcher'

const watcher = createConfigWatcher({
  baseDir: process.cwd(),
  compiler,
  debounceDelay: 500
})

watcher.on('compile-start', () => console.log('Compiling...'))
watcher.on('compile-success', (result) => console.log('Success!'))
watcher.on('compile-error', (error) => console.error('Error:', error))

await watcher.start()
```

### Error Formatting

Beautiful error output with code context:

```typescript
import { formatCompilationErrors } from '@lightfastai/compiler'

const errors = result.errors
console.error(formatCompilationErrors(errors))

// Output:
// ✖ TypeScript Error in lightfast.config.ts:12:5
//   
//   Property 'agent' does not exist on type 'Config'
//   
//   10 | export default createLightfast({
//   11 |   agents: {
// > 12 |     agent: myAgent
//      |     ^^^^^
//   13 |   }
//   14 | })
```

## API Reference

### `createCompiler(options)`

Creates a new compiler instance.

```typescript
interface CompilerOptions {
  baseDir?: string           // Base directory (default: process.cwd())
  entryPoint?: string        // Entry file (default: auto-detect)
  outputPath?: string        // Output directory (default: .lightfast)
  watch?: boolean           // Enable watching (default: false)
  cache?: boolean           // Enable caching (default: true)
  minify?: boolean          // Minify output (default: false)
  sourcemap?: boolean       // Generate sourcemaps (default: false)
}
```

### `compiler.compile(options)`

Compiles the TypeScript configuration.

```typescript
interface CompileOptions {
  configPath?: string        // Override config path
  force?: boolean           // Force recompilation
}

interface CompilationResult {
  success: boolean
  output: string            // Compiled JavaScript
  outputPath: string        // Output file path
  sourcePath: string        // Source file path
  errors: CompilationError[]
  warnings: CompilationWarning[]
  compilationTime: number   // Time in milliseconds
  fromCache: boolean
}
```

### `createConfigWatcher(options)`

Creates a file watcher for automatic recompilation.

```typescript
interface WatcherOptions {
  baseDir: string
  compiler: Compiler
  debounceDelay?: number    // Delay before recompiling (default: 300ms)
  ignoreInitial?: boolean   // Skip initial compilation (default: false)
  additionalWatchPaths?: string[] // Extra paths to watch
}
```

## Architecture

```
compiler/
├── src/
│   ├── index.ts          # Main API exports
│   ├── transpiler.ts     # esbuild integration
│   ├── cache.ts          # Caching system
│   ├── watcher.ts        # File watching
│   ├── bundler.ts        # Dependency bundling
│   └── error-formatter.ts # Error formatting
├── dist/                 # Compiled output
└── package.json
```

## Implementation Details

### Transpilation Process

1. **Discovery**: Find TypeScript config file
2. **Transpilation**: Use esbuild to compile TS → JS
3. **Bundling**: Resolve and bundle dependencies
4. **Caching**: Store result with content hash
5. **Output**: Write to `.lightfast/` directory

### Cache Strategy

```typescript
// Cache key generation
const cacheKey = crypto
  .createHash('sha256')
  .update(fileContent)
  .update(JSON.stringify(dependencies))
  .digest('hex')

// Cache structure
.lightfast/.cache/
├── manifest.json         # Cache metadata
├── [hash].js            # Compiled outputs
└── [hash].meta.json     # Compilation metadata
```

### Watch Algorithm

```typescript
// Debounced file watching
let timeout: NodeJS.Timeout

watcher.on('change', (path) => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    compile(path)
  }, debounceDelay)
})
```

## Performance

### Benchmarks

- **Initial compilation**: ~50ms for typical config
- **Cached compilation**: ~5ms
- **Watch mode reaction**: ~100ms from save to recompile
- **Large configs**: ~200ms for 100+ agents

### Optimization Techniques

1. **esbuild**: 100x faster than tsc
2. **Content hashing**: Skip unchanged files
3. **Selective watching**: Only watch relevant files
4. **Memory caching**: Hot paths stay in memory
5. **Parallel processing**: Multi-core utilization

## Development

### Building

```bash
# Build the package
pnpm build

# Watch mode
pnpm dev

# Type checking
pnpm typecheck

# Testing
pnpm test
```

### Testing Compilation

```typescript
// test/compile.test.ts
import { createCompiler } from '../src'

test('compiles TypeScript config', async () => {
  const compiler = createCompiler({
    entryPoint: 'test/fixtures/config.ts'
  })
  
  const result = await compiler.compile()
  expect(result.success).toBe(true)
  expect(result.output).toContain('createLightfast')
})
```

## File Structure

```
compiler/
├── src/
│   ├── index.ts          # ~100 lines - Main exports
│   ├── transpiler.ts     # ~200 lines - esbuild wrapper
│   ├── cache.ts          # ~150 lines - Caching logic
│   ├── watcher.ts        # ~180 lines - File watching
│   ├── bundler.ts        # ~120 lines - Bundling
│   └── error-formatter.ts # ~100 lines - Error formatting
├── dist/
│   ├── index.js          # Main bundle
│   ├── cache.js          # Cache module
│   ├── transpiler.js     # Transpiler module
│   └── *.d.ts           # TypeScript definitions
└── package.json
```

## Dependencies

- `esbuild` - TypeScript compilation
- `chokidar` - File watching
- `chalk` - Terminal colors
- `zod` - Schema validation

## Configuration

### esbuild Options

Default esbuild configuration:

```typescript
{
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  packages: 'external',
  sourcemap: false,
  minify: false,
  metafile: true
}
```

### File Patterns

Default file discovery patterns:

```typescript
const CONFIG_PATTERNS = [
  'lightfast.config.ts',
  'lightfast.config.js',
  'lightfast.config.mjs',
  '.lightfast/config.js'
]
```

## Error Handling

Comprehensive error types:

```typescript
enum CompilationErrorType {
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  TYPE_ERROR = 'TYPE_ERROR',
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  BUNDLING_ERROR = 'BUNDLING_ERROR'
}

interface CompilationError {
  type: CompilationErrorType
  message: string
  file?: string
  line?: number
  column?: number
  code?: string
}
```

## Publishing

This package is **not published to npm**. It's bundled into `@lightfastai/cli` during the build process.

## Contributing

When modifying the compiler:

1. Update source in `src/`
2. Add tests for new features
3. Run `pnpm build` in CLI package
4. Test with real configurations

## License

MIT © Lightfast

---

Part of the [Lightfast](https://github.com/lightfastai/lightfast) monorepo