import { StdioServerTransport } from "@vendor/mcp";
import { createLightfast } from "lightfast";
import { getLightfastMcpConfig } from "./config";
import { createLightfastMcpServer } from "./server";

async function main() {
  const { apiKey, baseUrl } = getLightfastMcpConfig();
  const client = createLightfast(apiKey, { baseUrl });
  const server = createLightfastMcpServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
