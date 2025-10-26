import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI entry point with shebang
  {
    entry: {
      cli: 'src/cli.tsx',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // MCP Server entry point with shebang
  {
    entry: {
      'mcp-server/index': 'src/mcp-server/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false, // Don't clean since cli already did
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // Library exports without shebang
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false, // Don't clean since cli already did
    shims: true,
  },
]);
