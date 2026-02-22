import { parseArgs } from "node:util";
import { LIGHTFAST_API_KEY_PREFIX } from "lightfast/constants";
import { createServer } from "./server";

const HELP_TEXT = `
Lightfast MCP Server - Connect AI assistants to your workspace memory

Usage:
  npx @lightfastai/mcp [options]

Options:
  --api-key <key>    Lightfast API key (or set LIGHTFAST_API_KEY env var)
  --base-url <url>   API base URL (default: https://lightfast.ai)
  --help, -h         Show this help message
  --version, -v      Show version

Examples:
  npx @lightfastai/mcp --api-key sk_abc123xyz
  LIGHTFAST_API_KEY=sk_abc123xyz npx @lightfastai/mcp

Configure in Claude Desktop (claude_desktop_config.json):
  {
    "mcpServers": {
      "lightfast": {
        "command": "npx",
        "args": ["-y", "@lightfastai/mcp", "--api-key", "sk_..."]
      }
    }
  }
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "api-key": { type: "string" },
      "base-url": { type: "string", default: "https://lightfast.ai" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    strict: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (values.version) {
    // Version injected at build time
    console.log("@lightfastai/mcp version 0.1.0-alpha.1");
    process.exit(0);
  }

  const apiKey = values["api-key"] ?? process.env.LIGHTFAST_API_KEY;

  if (!apiKey) {
    console.error(
      "Error: API key required. Use --api-key flag or set LIGHTFAST_API_KEY environment variable."
    );
    console.error("\nRun with --help for usage information.");
    process.exit(1);
  }

  if (!apiKey.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    console.error(
      `Error: Invalid API key format. Keys should start with '${LIGHTFAST_API_KEY_PREFIX}'`
    );
    process.exit(1);
  }

  const baseUrl = values["base-url"];

  // Start the MCP server
  await createServer({ apiKey, baseUrl });
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
