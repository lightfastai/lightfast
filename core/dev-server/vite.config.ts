import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({ customViteReactPlugin: true }),
    viteReact(),
  ],
  ssr: {
    // Bundle ALL dependencies instead of externalizing them
    // This makes the dev-server output completely self-contained
    // The CLI won't need to maintain any React/UI dependencies
    noExternal: true,
  },
  optimizeDeps: {
    // Pre-bundle these dependencies for better performance
    include: [
      'use-sync-external-store',
      'use-sync-external-store/shim/with-selector',
      '@tanstack/react-store',
    ],
  },
})
