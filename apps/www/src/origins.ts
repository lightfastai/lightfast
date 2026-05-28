import { withRelatedProject } from "@vercel/related-projects";
import { env } from "./env";

// Edge-safe cross-app URL helpers. Portless injects NEXT_PUBLIC_<APP>_URL in
// dev; preview/prod resolve through @vercel/related-projects.
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
