# lightfast

## 0.3.0

### Minor Changes

- 55e5e6c: Adopt oRPC for the public SDK and MCP surfaces.

  - SDK (`lightfast`): `createLightfast(apiKey, options)` now returns a typed `ContractRouterClient<Contract>` constructed via `@orpc/openapi-client/fetch`. Calls hit the new `/api/v1/*` REST surface on `apps/app`. The `LightfastClient` class is removed — it's now a type alias to `ContractRouterClient<Contract>`. This is a pre-1.0 incompatible API change for any consumer using `new LightfastClient(...)`.
  - MCP (`@lightfastai/mcp`): The server auto-registers tools from `@repo/api-contract`. Current exposed tools are `lightfast_system_health`, `lightfast_signals_create`, and `lightfast_signals_get`. Adding procedures to the contract auto-registers them as MCP tools — no `core/mcp` changes required.
  - Publish hygiene: `@repo/api-contract` is bundled into the published `dist/` via tsup `noExternal`. Moved from `dependencies` to `devDependencies` to keep the published manifest free of private workspace references. `lightfast` (in MCP) moved the same way. Stable releases publish to the npm `latest` dist-tag.

  Requires: `LIGHTFAST_API_KEY` (`lf_` org API key) to authenticate. Optional: `LIGHTFAST_API_URL` to point at non-prod environments.

### Patch Changes

- 88e147d: Promote the public SDK and MCP packages to the npm latest dist-tag.

## 1.0.0-alpha.7

### Patch Changes

- 7a6122e: Publish prerelease packages through the npm alpha dist-tag.

## 1.0.0-alpha.6

### Major Changes

- 55e5e6c: Adopt oRPC for the public SDK and MCP surfaces.

  - SDK (`lightfast`): `createLightfast(apiKey, options)` now returns a typed `ContractRouterClient<Contract>` constructed via `@orpc/openapi-client/fetch`. Calls hit the new `/api/v1/*` REST surface on `apps/app`. The `LightfastClient` class is removed — it's now a type alias to `ContractRouterClient<Contract>`. Breaking change for any consumer using `new LightfastClient(...)`.
  - MCP (`@lightfastai/mcp`): The server auto-registers tools from `@repo/api-contract`. Current exposed tools are `lightfast_system_health`, `lightfast_signals_create`, and `lightfast_signals_get`. Adding procedures to the contract auto-registers them as MCP tools — no `core/mcp` changes required.
  - Publish hygiene: `@repo/api-contract` is bundled into the published `dist/` via tsup `noExternal`. Moved from `dependencies` to `devDependencies` to keep the published manifest free of private workspace references. `lightfast` (in MCP) moved the same way. `publishConfig.tag` changed from `"latest"` to `"alpha"` so pre-release versions no longer claim the default install slot.

  Requires: `LIGHTFAST_API_KEY` (`lf_` org API key) to authenticate. Optional: `LIGHTFAST_API_URL` to point at non-prod environments.

## 0.1.0-alpha.5

### Patch Changes

- Add comprehensive package README with accurate API documentation. Includes complete API reference for all 5 methods, real-world usage examples, TypeScript support, and error handling documentation.

## 0.1.0-alpha.4

### Patch Changes

- Fix MCP external installation by exporting Zod schemas from SDK. The MCP package previously depended on unpublished workspace packages, causing npm installation failures. This release moves Zod schema exports to the published SDK.

## 0.1.0-alpha.3

### Patch Changes

- Fix API key format validation to accept `sk-lf-` prefix instead of incorrect `sk_` prefix. Updated all documentation and examples to use correct format.

## 0.1.0-alpha.2

### Patch Changes

- Package dependency updates and workspace protocol fixes

## 0.1.0-alpha.1

### Patch Changes

- Initial alpha release of the Lightfast Neural Memory SDK
