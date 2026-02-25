import { GatewayClient } from "@repo/console-gateway-client";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "../env";

const isDevelopment =
  env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";

const gatewayUrl = withRelatedProject({
  projectName: "lightfast-gateway",
  defaultHost: isDevelopment
    ? "http://localhost:4108"
    : "https://gateway.lightfast.ai",
});

export const gatewayClient = new GatewayClient(gatewayUrl, env.GATEWAY_API_KEY);
