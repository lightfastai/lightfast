import { LINEAR_EMULATOR_FIXTURES, LINEAR_EMULATOR_TOOLS } from "../fixtures";

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
  const toolItems = LINEAR_EMULATOR_TOOLS.map(
    (tool) => `<li>
      <span>${escapeHtml(tool.name)}</span>
      <small>${escapeHtml(tool.description)}</small>
    </li>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Linear MCP - Local emulator</title>
  <style>
    :root {
      color-scheme: light;
      --background: #f7f7f5;
      --panel: #ffffff;
      --border: #dfddd7;
      --text: #1d1d1f;
      --muted: #686761;
      --accent: #5e6ad2;
      --accent-soft: #eef0ff;
      --success: #16845b;
      --code: #f1f0ec;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--background);
      color: var(--text);
      font-family:
        Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
        "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    main {
      width: min(960px, calc(100vw - 32px));
      margin: 56px auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 28px;
    }

    h1 {
      margin: 0;
      font-size: 32px;
      line-height: 1.1;
      font-weight: 650;
      letter-spacing: 0;
    }

    p {
      margin: 8px 0 0;
      color: var(--muted);
      max-width: 640px;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #b8dec9;
      border-radius: 999px;
      background: #eefaf3;
      color: var(--success);
      padding: 6px 10px;
      font-size: 13px;
      font-weight: 550;
      white-space: nowrap;
    }

    .status::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: currentColor;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      gap: 16px;
      align-items: start;
    }

    section {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
    }

    .section-header {
      border-bottom: 1px solid var(--border);
      padding: 16px 18px;
    }

    h2 {
      margin: 0;
      font-size: 15px;
      line-height: 1.3;
      font-weight: 650;
      letter-spacing: 0;
    }

    .content {
      padding: 18px;
    }

    dl {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      gap: 12px 16px;
      margin: 0;
    }

    dt {
      color: var(--muted);
      font-size: 13px;
    }

    dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    code {
      border-radius: 6px;
      background: var(--code);
      padding: 2px 5px;
      font-family:
        "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 13px;
    }

    .setup {
      display: block;
      margin-top: 10px;
      padding: 12px;
      overflow-x: auto;
      white-space: nowrap;
    }

    .tools {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tools li {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding: 12px 0;
      border-top: 1px solid var(--border);
    }

    .tools li:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .tools span {
      font-family:
        "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 13px;
      font-weight: 600;
    }

    .tools small {
      color: var(--muted);
      text-align: right;
    }

    .pill {
      display: inline-flex;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 600;
    }

    @media (max-width: 760px) {
      main {
        margin: 28px auto;
      }

      header,
      .grid {
        display: block;
      }

      .status {
        margin-top: 16px;
      }

      section {
        margin-top: 16px;
      }

      dl {
        grid-template-columns: 1fr;
        gap: 4px 0;
      }

      dd {
        margin-bottom: 12px;
      }

      .tools li {
        display: block;
      }

      .tools small {
        display: block;
        margin-top: 4px;
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Linear MCP</h1>
        <p>Local emulator for the Linear MCP endpoint. Use this page to inspect the local endpoint that connector development talks to.</p>
      </div>
      <div class="status">Local emulator online</div>
    </header>

    <div class="grid">
      <section>
        <div class="section-header">
          <h2>Endpoint</h2>
        </div>
        <div class="content">
          <dl>
            <dt>URL</dt>
            <dd><code>${escapedEndpoint}</code></dd>
            <dt>Transport</dt>
            <dd>Streamable HTTP JSON-RPC</dd>
            <dt>Setup</dt>
            <dd><code class="setup">npx mcp-remote ${escapedEndpoint}</code></dd>
          </dl>
        </div>
      </section>

      <section>
        <div class="section-header">
          <h2>Connection</h2>
        </div>
        <div class="content">
          <dl>
            <dt>Workspace</dt>
            <dd>${escapeHtml(LINEAR_EMULATOR_FIXTURES.workspaceName)} <code>${escapeHtml(LINEAR_EMULATOR_FIXTURES.workspaceId)}</code></dd>
            <dt>Actor</dt>
            <dd>${escapeHtml(LINEAR_EMULATOR_FIXTURES.actorName)} <code>${escapeHtml(LINEAR_EMULATOR_FIXTURES.actorId)}</code></dd>
            <dt>Mode</dt>
            <dd><span class="pill">Local emulator</span></dd>
          </dl>
        </div>
      </section>
    </div>

    <section style="margin-top: 16px;">
      <div class="section-header">
        <h2>${LINEAR_EMULATOR_TOOLS.length} tools</h2>
      </div>
      <div class="content">
        <ul class="tools">${toolItems}</ul>
      </div>
    </section>
  </main>
</body>
</html>`;
}
