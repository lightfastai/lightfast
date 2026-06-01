import { createMcpHandler, withMcpAuth } from "mcp-handler";

import { env } from "../../env";
import { registerHostedMcpTools } from "../../tools/execute";
import { verifyMcpAuthInfo } from "../../auth/verify-token";

export const runtime = "nodejs";

const resourceOrigin = new URL(env.MCP_RESOURCE_URL).origin;

const handler = createMcpHandler(
  (server) => {
    registerHostedMcpTools(server);
  },
  {
    serverInfo: {
      name: "lightfast",
      version: process.env.npm_package_version ?? "0.1.0",
    },
  },
  {
    basePath: "",
    disableSse: true,
    maxDuration: 60,
  }
);

const authenticatedHandler = withMcpAuth(handler, verifyMcpAuthInfo, {
  required: true,
  resourceUrl: resourceOrigin,
});

export { authenticatedHandler as GET, authenticatedHandler as POST };
