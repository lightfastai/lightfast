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
    // Don't externalize these problematic CommonJS modules
    // They need to be transpiled for ESM compatibility
    noExternal: ['use-sync-external-store', '@tanstack/react-store'],
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
