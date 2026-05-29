---
name: orpc
description: Use when building, reviewing, or debugging oRPC code — defining contracts, writing routers/procedures/middleware, wiring an RPCHandler or OpenAPIHandler, calling procedures via RPCLink or server-side clients, integrating TanStack Query / AI SDK / Better Auth, exposing Server Actions, or generating OpenAPI specs. Load when a file imports `@orpc/*` or the task involves type-safe RPC/OpenAPI APIs.
---

# oRPC

Use this skill to build and review oRPC code against the official documentation.

> **What it is:** oRPC (OpenAPI Remote Procedure Call) defines and calls remote/local procedures through an end-to-end type-safe API that also adheres to the OpenAPI spec. Official docs: <https://orpc.dev>. Repo: <https://github.com/unnoq/orpc>.

## How to use the references

oRPC ships **LLM-friendly docs**, not a code skill. Every reference below is a Markdown rendering of a docs page (`.md` suffix). Fetch only the pages relevant to the task.

- **Index of all pages:** <https://orpc.dev/llms.txt>
- **Full docs in one file (large):** <https://orpc.dev/llms-full.txt>
- Any docs URL works as Markdown by appending `.md` (e.g. `https://orpc.dev/docs/router.md`).

## Workflow
1. Identify the surface: contract, router/procedure, handler (RPC vs OpenAPI), client (server-side vs link), or integration.
2. Read only the relevant reference page(s) below — append `.md`, don't guess APIs.
3. Prefer **contract-first** when client and server are separate packages; co-located code can use the router directly.
4. Match the project's existing handler and serializer choices before introducing new ones.
5. Validate type-safety end to end; throw `Error` instances, never literals.

## Core Concepts
- [Getting Started](https://orpc.dev/docs/getting-started.md)
- [Procedure](https://orpc.dev/docs/procedure.md)
- [Router](https://orpc.dev/docs/router.md)
- [Middleware](https://orpc.dev/docs/middleware.md)
- [Context](https://orpc.dev/docs/context.md)
- [Metadata](https://orpc.dev/docs/metadata.md)
- [Error Handling](https://orpc.dev/docs/error-handling.md)
- [Event Iterator (SSE)](https://orpc.dev/docs/event-iterator.md)
- [File Upload and Download](https://orpc.dev/docs/file-upload-download.md)
- [Server Action](https://orpc.dev/docs/server-action.md)
- [Comparison vs other RPC/REST](https://orpc.dev/docs/comparison.md)

## Contract First
- [Define Contract](https://orpc.dev/docs/contract-first/define-contract.md)
- [Implement Contract](https://orpc.dev/docs/contract-first/implement-contract.md)
- [Router to Contract](https://orpc.dev/docs/contract-first/router-to-contract.md)

## Handlers
- [RPC Handler](https://orpc.dev/docs/rpc-handler.md)
- [OpenAPI Handler](https://orpc.dev/docs/openapi/openapi-handler.md)
- [OpenAPI Routing](https://orpc.dev/docs/openapi/routing.md)
- [OpenAPI Specification](https://orpc.dev/docs/openapi/openapi-specification.md)

## Clients
- [Server-Side Clients](https://orpc.dev/docs/client/server-side.md)
- [Client-Side Clients](https://orpc.dev/docs/client/client-side.md)
- [RPCLink](https://orpc.dev/docs/client/rpc-link.md)
- [DynamicLink](https://orpc.dev/docs/client/dynamic-link.md)
- [Client Error Handling](https://orpc.dev/docs/client/error-handling.md)
- [Client Event Iterator](https://orpc.dev/docs/client/event-iterator.md)

## Adapters (server framework hosting)
- [HTTP](https://orpc.dev/docs/adapters/http.md) · [Next.js](https://orpc.dev/docs/adapters/next.md) · [Hono](https://orpc.dev/docs/adapters/hono.md) · [Express](https://orpc.dev/docs/adapters/express.md) · [Fastify](https://orpc.dev/docs/adapters/fastify.md)
- [WebSocket](https://orpc.dev/docs/adapters/websocket.md) · [Message Port](https://orpc.dev/docs/adapters/message-port.md) · [Electron](https://orpc.dev/docs/adapters/electron.md) · [Browser](https://orpc.dev/docs/adapters/browser.md)
- Full adapter list (Astro, Elysia, H3, Nuxt, Remix, Solid Start, SvelteKit, TanStack Start, React Native, Web/Worker Threads): see [llms.txt](https://orpc.dev/llms.txt)

## Plugins
- [CORS](https://orpc.dev/docs/plugins/cors.md) · [Request Validation](https://orpc.dev/docs/plugins/request-validation.md) · [Response Validation](https://orpc.dev/docs/plugins/response-validation.md)
- [Batch Requests](https://orpc.dev/docs/plugins/batch-requests.md) · [Dedupe Requests](https://orpc.dev/docs/plugins/dedupe-requests.md) · [Client Retry](https://orpc.dev/docs/plugins/client-retry.md)
- [Body Limit](https://orpc.dev/docs/plugins/body-limit.md) · [Compression](https://orpc.dev/docs/plugins/compression.md) · [Simple CSRF Protection](https://orpc.dev/docs/plugins/simple-csrf-protection.md) · [Strict GET Method](https://orpc.dev/docs/plugins/strict-get-method.md)

## Integrations
- [TanStack Query](https://orpc.dev/docs/integrations/tanstack-query.md)
- [AI SDK](https://orpc.dev/docs/integrations/ai-sdk.md)
- [Better Auth](https://orpc.dev/docs/integrations/better-auth.md)
- [OpenTelemetry](https://orpc.dev/docs/integrations/opentelemetry.md)
- [Sentry](https://orpc.dev/docs/integrations/sentry.md)
- [Pino logging](https://orpc.dev/docs/integrations/pino.md)
- [tRPC interop](https://orpc.dev/docs/openapi/integrations/trpc.md) · [NestJS](https://orpc.dev/docs/openapi/integrations/implement-contract-in-nest.md)

## Best Practices
- [Monorepo Setup](https://orpc.dev/docs/best-practices/monorepo-setup.md)
- [Optimize SSR](https://orpc.dev/docs/best-practices/optimize-ssr.md)
- [Dedupe Middleware](https://orpc.dev/docs/best-practices/dedupe-middleware.md)
- [No Throw Literal](https://orpc.dev/docs/best-practices/no-throw-literal.md)

## Advanced
- [Building Custom Plugins](https://orpc.dev/docs/advanced/building-custom-plugins.md)
- [Testing & Mocking](https://orpc.dev/docs/advanced/testing-mocking.md)
- [RPC Protocol](https://orpc.dev/docs/advanced/rpc-protocol.md)
- [RPC JSON Serializer](https://orpc.dev/docs/advanced/rpc-json-serializer.md) · [SuperJson](https://orpc.dev/docs/advanced/superjson.md)
- [Validation Errors](https://orpc.dev/docs/advanced/validation-errors.md)
- [Publish Client to NPM](https://orpc.dev/docs/advanced/publish-client-to-npm.md)
- [Migrating from tRPC](https://orpc.dev/docs/migrations/from-trpc.md)

## Guardrails
- Don't invent API surface — fetch the relevant `.md` page; oRPC's API is versioned and changes between majors.
- Throw `Error` instances, never literal values (oRPC error flow + type inference depend on it).
- Keep contract and implementation types in sync; let the contract drive client types.
- Respect the project's existing handler/serializer/adapter choices instead of mixing them.
