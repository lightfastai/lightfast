import "@tanstack/react-start/server-only";

import { createMcpHandler } from "@vendor/mcp";
import { env } from "~/env";
import { withHostedMcpAuth } from "~/server/auth-wrapper";
import { registerHostedMcpTools } from "~/tools/execute";

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

const verifyAuthInfo = async (request: Request, bearerToken?: string) => {
  const { verifyMcpAuthInfo } = await import("~/auth/verify-token");
  return verifyMcpAuthInfo(request, bearerToken);
};

export const mcpHandler = withHostedMcpAuth(handler, verifyAuthInfo, {
  required: true,
  resourceUrl: resourceOrigin,
});
