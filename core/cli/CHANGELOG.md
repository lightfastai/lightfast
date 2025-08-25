# @lightfastai/cli

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
