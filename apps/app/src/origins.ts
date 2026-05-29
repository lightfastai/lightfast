import { withRelatedProject } from "@vercel/related-projects";
import { env } from "./env";

// Cross-app URLs. Edge-safe: no fs access, no NodeJS-only deps. In local dev,
// package scripts inject NEXT_PUBLIC_<APP>_URL=$(portless get <name>.lightfast).
// Preview/prod resolve through VERCEL_RELATED_PROJECTS when available.
export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: env.NEXT_PUBLIC_APP_URL,
});

export const wwwUrl = withRelatedProject({
  projectName: "lightfast-www",
  defaultHost: env.NEXT_PUBLIC_WWW_URL,
});

export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: env.NEXT_PUBLIC_PLATFORM_URL,
});
