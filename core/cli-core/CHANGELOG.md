# @lightfastai/cli-core

## 0.2.3

### Patch Changes

- Updated dependencies [27173bc]
  - @lightfastai/dev-server@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [dea3e10]
  - @lightfastai/dev-server@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [b653ea7]
  - @lightfastai/dev-server@0.2.1

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
  - @lightfastai/dev-server@0.2.0
