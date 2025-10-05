import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI entry point with shebang
  {
    entry: ['src/cli.tsx'],
    format: ['esm'],
    dts: true,
    clean: true,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // Library exports without shebang
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: false, // Don't clean since cli already did
    shims: true,
  },
]);
