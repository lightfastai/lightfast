import {
  GRANOLA_EMULATOR_FIXTURES,
  GRANOLA_EMULATOR_NOTES,
  GRANOLA_EMULATOR_TOOLS,
} from "../fixtures";

export function renderGranolaMcpPage(mcpEndpoint: string): string {
  const remoteCommand = `npx mcp-remote ${mcpEndpoint}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Granola MCP Emulator</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; padding: 40px; background: #f7f5ef; color: #1e1d19; }
      main { max-width: 760px; margin: 0 auto; }
      code, pre { background: #ebe7dc; border-radius: 6px; padding: 2px 6px; }
      pre { overflow-x: auto; padding: 16px; }
      .meta { color: #6f6758; }
    </style>
  </head>
  <body>
    <main>
      <p class="meta">Local emulator</p>
      <h1>Granola MCP</h1>
      <p>${GRANOLA_EMULATOR_FIXTURES.accountName} exposes ${GRANOLA_EMULATOR_TOOLS.length} tools over MCP with ${GRANOLA_EMULATOR_NOTES.length} deterministic notes.</p>
      <pre>${remoteCommand}</pre>
      <p class="meta">Endpoint: <code>${mcpEndpoint}</code></p>
      <p class="meta">Tools: ${GRANOLA_EMULATOR_TOOLS.map((tool) => tool.name).join(", ")}</p>
    </main>
  </body>
</html>`;
}
