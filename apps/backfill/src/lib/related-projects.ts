import { withRelatedProject } from "@vendor/related-projects";

import { env } from "../env.js";

const isDevelopment =
  env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";

export const relayUrl = `${withRelatedProject({
  projectName: "lightfast-relay",
  defaultHost: isDevelopment
    ? "http://localhost:4108"
    : "https://relay.lightfast.ai",
})}/api`;

export const gatewayUrl = `${withRelatedProject({
  projectName: "lightfast-gateway",
  defaultHost: isDevelopment
    ? "http://localhost:4110"
    : "https://gateway.lightfast.ai",
})}/services`;
