# @lightfastai/dev-server

## 0.2.1

### Patch Changes

- b653ea7: Fix CLI React dependency errors by bundling UI deps in dev-server

  The CLI v0.3.0 was failing when installed via npx with "Cannot find package 'react'" errors. Instead of adding React dependencies to the CLI package (which would bloat it), we configure the dev-server build to bundle all UI dependencies.
  - Configure Vite SSR to bundle React/UI deps instead of externalizing them
  - Keep CLI package.json clean with only core dependencies (5 vs 15+ deps)
  - Self-contained dev-server output that works via npx
  - Architecturally cleaner than polluting CLI deps with UI libraries

## 0.2.0

### Minor Changes

- a2dee14: Initial release of the Lightfast CLI ecosystem

  ### Major Features
  - **@lightfastai/cli**: Complete CLI package with all commands (dev, compile, bundle, clean)
  - **@lightfastai/compiler**: TypeScript compilation engine with caching and hot reload
  - **@lightfastai/dev-server**: React-based development UI with agent discovery
  - **@lightfastai/cli-core**: Core CLI logic and command implementations

  ### Key Improvements
  - On-demand bundling architecture for faster development builds
  - Agent discovery and management system
  - Beautiful TanStack Start + React 19 UI
  - Complete TypeScript support with hot reload
  - Sophisticated caching system for compilation
  - Single npm package installation (`@lightfastai/cli`)

  ### Commands
  - `dev` - Start development server with hot reload
  - `compile` - Transpile TypeScript configurations
  - `bundle` - Generate deployment bundles (on-demand)
  - `clean` - Remove build artifacts and caches

  This release establishes the foundation for the Lightfast agent development ecosystem.

### Patch Changes

- Updated dependencies [a2dee14]
  - @lightfastai/compiler@0.2.0
