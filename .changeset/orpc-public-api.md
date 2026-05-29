---
"lightfast": major
"@lightfastai/mcp": major
---

Adopt oRPC for the public SDK and MCP surfaces.

- SDK (`lightfast`): `createLightfast(apiKey, options)` now returns a typed `ContractRouterClient<Contract>` constructed via `@orpc/openapi-client/fetch`. Calls hit the new `/api/v1/*` REST surface on `apps/app`. The `LightfastClient` class is removed — it's now a type alias to `ContractRouterClient<Contract>`. Breaking change for any consumer using `new LightfastClient(...)`.
- MCP (`@lightfastai/mcp`): The server auto-registers tools from `@repo/api-contract`. Current exposed tools are `lightfast_system_health`, `lightfast_signals_create`, and `lightfast_signals_get`. Adding procedures to the contract auto-registers them as MCP tools — no `core/mcp` changes required.
- Publish hygiene: `@repo/api-contract` is bundled into the published `dist/` via tsup `noExternal`. Moved from `dependencies` to `devDependencies` to keep the published manifest free of private workspace references. `lightfast` (in MCP) moved the same way. `publishConfig.tag` changed from `"latest"` to `"alpha"` so pre-release versions no longer claim the default install slot.

Requires: `LIGHTFAST_API_KEY` (`lf_` org API key) to authenticate. Optional: `LIGHTFAST_API_URL` to point at non-prod environments.
