# Linear Emulator MCP Endpoint UI

**Date:** 2026-06-02
**Status:** Approved scope

## Goal

Make the local Linear emulator's MCP endpoint useful when opened in a browser.
`GET /mcp` should render a lightweight Linear-inspired status page, while
`POST /mcp` remains the unchanged machine-facing JSON-RPC endpoint used by the
connector flow.

## Decisions

- Add the UI only to `@repo/linear-emulator`.
- Serve static HTML from the emulator route layer; do not introduce React,
  Next.js, a bundler, or client-side JavaScript.
- Keep the existing `POST /mcp` behavior and tests intact.
- The page may mimic the practical feel of Linear's public MCP endpoint, but it
  must clearly identify itself as the Lightfast local emulator.

## UI Content

The page should show:

- "Linear MCP" as the primary title.
- Local emulator status.
- Workspace name and id from `LINEAR_EMULATOR_FIXTURES`.
- Actor name and id from `LINEAR_EMULATOR_FIXTURES`.
- The current endpoint URL, derived from the incoming request origin plus
  `/mcp`.
- Transport/protocol copy for Streamable HTTP JSON-RPC.
- Tool count and deterministic tool list from `LINEAR_EMULATOR_TOOLS`.
- A short local setup command using `npx mcp-remote <endpoint>`.

## Non-Goals

- No auth UI.
- No OAuth state changes.
- No connector page dependency on the emulator UI.
- No pixel-perfect clone of Linear's private authenticated page.
- No changes to real Linear provider config.

## Testing

Add a focused regression test in the existing Linear emulator server test suite:

- `GET /mcp` returns `200`.
- `content-type` includes `text/html`.
- The body includes the expected title, local workspace, actor, endpoint, setup
  command, tool count, and representative tool names.

Existing MCP JSON-RPC tests remain the compatibility guard for `POST /mcp`.
