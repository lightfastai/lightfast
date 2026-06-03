import "@tanstack/react-start/server-only";

import { createMcpHandler, withMcpAuth } from "@vendor/mcp";
import { env } from "~/env";
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

const verifyAuthInfo: Parameters<typeof withMcpAuth>[1] = async (
  request,
  bearerToken
) => {
  const { verifyMcpAuthInfo } = await import("~/auth/verify-token");
  return verifyMcpAuthInfo(request, bearerToken);
};

export const mcpHandler = withMcpAuth(handler, verifyAuthInfo, {
  required: true,
  resourceUrl: resourceOrigin,
});
