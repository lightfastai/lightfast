# @lightfastai/cli

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
