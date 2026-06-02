# Linear Emulator MCP Endpoint UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-facing `GET /mcp` HTML page to the Linear emulator without changing the existing `POST /mcp` MCP JSON-RPC endpoint.

**Architecture:** Keep the existing Linear plugin split. Add a small `mcp-ui.ts` renderer for static HTML and register `GET /mcp` from `mcp.ts` before the existing `POST /mcp` handler. The renderer reads from `LINEAR_EMULATOR_FIXTURES` and `LINEAR_EMULATOR_TOOLS`, derives the current endpoint from the request origin, and escapes dynamic text before interpolation.

**Tech Stack:** TypeScript ESM, Hono via `@emulators/core`, Vitest, pnpm workspaces.

---

## File Structure

- Modify `emulators/linear/src/__tests__/server.test.ts`: add a failing regression test for browser `GET /mcp`.
- Create `emulators/linear/src/plugin/mcp-ui.ts`: static HTML renderer plus minimal escaping helper.
- Modify `emulators/linear/src/plugin/mcp.ts`: register `GET /mcp` and keep existing `POST /mcp` unchanged.

## Task 1: Add the regression test

- [ ] **Step 1: Add the failing test**

Add a test near the other MCP tests:

```ts
  it("renders a browser UI for the MCP endpoint", async () => {
    const active = await start();

    const res = await fetch(`${active.url}/mcp`, {
      headers: { accept: "text/html" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Linear MCP");
    expect(html).toContain("Lightfast local emulator");
    expect(html).toContain(LINEAR_EMULATOR_FIXTURES.workspaceName);
    expect(html).toContain(LINEAR_EMULATOR_FIXTURES.actorName);
    expect(html).toContain(`${active.url}/mcp`);
    expect(html).toContain(`npx mcp-remote ${active.url}/mcp`);
    expect(html).toContain(`${LINEAR_EMULATOR_TOOLS.length} tools`);
    expect(html).toContain("list_issues");
    expect(html).toContain("create_issue");
  });
```

- [ ] **Step 2: Verify it fails**

Run:

```bash
pnpm --filter @repo/linear-emulator test -- src/__tests__/server.test.ts
```

Expected: fail because `GET /mcp` does not yet return the HTML page.

## Task 2: Implement the static page

- [ ] **Step 1: Add `mcp-ui.ts`**

Create `emulators/linear/src/plugin/mcp-ui.ts` with:

```ts
import {
  LINEAR_EMULATOR_FIXTURES,
  LINEAR_EMULATOR_TOOLS,
} from "../fixtures";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderLinearMcpPage(endpoint: string): string {
  const escapedEndpoint = escapeHtml(endpoint);
  const tools = LINEAR_EMULATOR_TOOLS.map(
    (tool) => `
      <li>
        <span>${escapeHtml(tool.name)}</span>
        <small>${escapeHtml(tool.description)}</small>
      </li>`
  ).join("");

  return `<!doctype html>
<html lang="en">
...
</html>`;
}
```

The final HTML should include inline CSS only, no scripts, and the text asserted
by the test.

- [ ] **Step 2: Register `GET /mcp`**

In `emulators/linear/src/plugin/mcp.ts`, import `renderLinearMcpPage`, derive
the endpoint from `new URL(c.req.url)`, and return HTML with
`content-type: text/html; charset=utf-8`.

- [ ] **Step 3: Verify green**

Run:

```bash
pnpm --filter @repo/linear-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/linear-emulator typecheck
```

Expected: all Linear emulator tests pass and TypeScript reports no errors.

## Task 3: Final check

- [ ] **Step 1: Run formatting/lint check**

Run:

```bash
pnpm dlx ultracite@latest check emulators/linear/src/plugin/mcp-ui.ts emulators/linear/src/plugin/mcp.ts emulators/linear/src/__tests__/server.test.ts
```

Expected: no errors. If fixes are needed, run `pnpm dlx ultracite@latest fix`
on the same paths, then rerun Linear emulator tests.

- [ ] **Step 2: Manual smoke**

Run the emulator and open or curl `GET /mcp`:

```bash
PORT=4568 pnpm --filter @repo/linear-emulator dev
curl -s http://127.0.0.1:4568/mcp | rg "Linear MCP|Lightfast local emulator|list_issues"
```

Expected: the HTML contains the asserted UI text. Stop the emulator afterward.
