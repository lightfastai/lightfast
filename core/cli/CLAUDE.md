# CLI Development Guide

## Testing Workflows

### Local Development
```bash
# Run dev server directly (hot reload)
pnpm dev

# Test CLI from source
pnpm cli:dev  # Watch mode
node dist/index.js dev --port 4000
```

### Build Testing
```bash
# Build everything (CLI + TanStack app)
pnpm cli:build

# Test built CLI
node dist/index.js dev

# Test production server directly
node .output/server/index.mjs
```

### Simulating npm Install
```bash
# Method 1: npm pack
npm pack
npm install -g ./lightfastai-cli-*.tgz
cli dev

# Method 2: pnpm link
pnpm link --global
cli dev

# Method 3: Run from outside project
cd /tmp
node /path/to/project/core/cli/dist/index.js dev
```

## Key Files
- `src/cli/commands/dev.ts` - Dev server command logic
- `tsup.config.ts` - CLI bundling config
- `vite.config.ts` - TanStack app config
- `dist/` - Built CLI binary
- `.output/` - Built TanStack app

## Build Process
1. `pnpm build:app` - Builds TanStack app to `.output/`
2. `tsup` - Bundles CLI to `dist/`
3. Both are included in npm package

## Production Detection
CLI checks if running from `dist/` folder:
- **Production**: Serves `.output/server/index.mjs`
- **Development**: Runs `vite dev` for hot reload