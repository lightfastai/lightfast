# @lightfastai/mcp

## 1.0.0-alpha.6

### Major Changes

- 55e5e6c: Adopt oRPC for the public SDK and MCP surfaces.

  - SDK (`lightfast`): `createLightfast(apiKey, options)` now returns a typed `ContractRouterClient<Contract>` constructed via `@orpc/openapi-client/fetch`. Calls hit the new `/api/v1/*` REST surface on `apps/app`. The `LightfastClient` class is removed — it's now a type alias to `ContractRouterClient<Contract>`. Breaking change for any consumer using `new LightfastClient(...)`.
  - MCP (`@lightfastai/mcp`): The server auto-registers tools from `@repo/api-contract`. Current exposed tools are `lightfast_system_health`, `lightfast_signals_create`, and `lightfast_signals_get`. Adding procedures to the contract auto-registers them as MCP tools — no `core/mcp` changes required.
  - Publish hygiene: `@repo/api-contract` is bundled into the published `dist/` via tsup `noExternal`. Moved from `dependencies` to `devDependencies` to keep the published manifest free of private workspace references. `lightfast` (in MCP) moved the same way. `publishConfig.tag` changed from `"latest"` to `"alpha"` so pre-release versions no longer claim the default install slot.

  Requires: `LIGHTFAST_API_KEY` (`lf_` org API key) to authenticate. Optional: `LIGHTFAST_API_URL` to point at non-prod environments.

## 0.1.0-alpha.5

### Patch Changes

- Add comprehensive package README with accurate MCP documentation. Includes setup guides for Claude Desktop, Code, Cursor, and Cline; all 5 MCP tools documented with correct names; complete response schemas; and troubleshooting guide.
- Updated dependencies
  - lightfast@0.1.0-alpha.5

## 0.1.0-alpha.4

### Patch Changes

- Fix MCP external installation by importing schemas from published SDK. Eliminates unpublished workspace dependencies.
- Updated dependencies
  - lightfast@0.1.0-alpha.4

## 0.1.0-alpha.3

### Patch Changes

- Fix MCP server API key validation to accept `sk-lf-` prefix. Updated all MCP examples and configuration files.
- Updated dependencies
  - lightfast@0.1.0-alpha.3

## 0.1.0-alpha.2

### Patch Changes

- Use workspace protocol for local SDK development to eliminate lockfile sync issues
- Updated dependencies
  - lightfast@0.1.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- Initial alpha release of the Lightfast MCP Server
- Updated dependencies
  - lightfast@0.1.0-alpha.1
