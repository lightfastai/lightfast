import { withRelatedProject } from "@vendor/related-projects";

import { env } from "../env.js";

const isDevelopment =
  env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";

export const gatewayUrl = `${withRelatedProject({
  projectName: "lightfast-gateway",
  defaultHost: isDevelopment
    ? "http://localhost:4108"
    : "https://gateway.lightfast.ai",
})}/api`;

export const connectionsUrl = `${withRelatedProject({
  projectName: "lightfast-connections",
  defaultHost: isDevelopment
    ? "http://localhost:4110"
    : "https://connections.lightfast.ai",
})}/services`;
