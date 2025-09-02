# @lightfastai/cli

## 0.3.2

### Patch Changes

- Bundle updated dev-server v0.2.2 with comprehensive dependency bundling

  The CLI needs to include the updated dev-server v0.2.2 which contains the comprehensive bundling fix.
  This ensures users get the fully self-contained dev-server when installing the CLI via npx.
  - Includes dev-server v0.2.2 with all dependencies bundled
  - Fixes all React and @tanstack/react-router module resolution errors
  - Ensures CLI works correctly when installed via npx

## 0.3.1

### Patch Changes

- b653ea7: Fix CLI React dependency errors by bundling UI deps in dev-server

  The CLI v0.3.0 was failing when installed via npx with "Cannot find package 'react'" errors. Instead of adding React dependencies to the CLI package (which would bloat it), we configure the dev-server build to bundle all UI dependencies.
  - Configure Vite SSR to bundle React/UI deps instead of externalizing them
  - Keep CLI package.json clean with only core dependencies (5 vs 15+ deps)
  - Self-contained dev-server output that works via npx
  - Architecturally cleaner than polluting CLI deps with UI libraries

## 0.3.0

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

## 0.2.1

### Patch Changes

- 5c5690b: feat: Add React 19 client-side dashboard with Vite bundling
  - Implement client-side React dashboard for agent monitoring
  - Set up Vite bundler for production builds
  - Configure Hono server to serve static files and API routes
  - Add development UI with real-time status updates
  - Prepare package for npm publishing with proper dependencies

## 0.2.0

### Minor Changes

- b307825: Initial release of @lightfastai/cli
  - Integrated Hono dev server for local development
  - `npx @lightfastai/cli dev` command to start dev server
  - Support for custom port and host configuration
  - API endpoints for agents, executions, and resources (placeholders)
