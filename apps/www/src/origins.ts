import { withRelatedProject } from "@vercel/related-projects";

// Edge-safe cross-app URL helpers. dev:app injects NEXT_PUBLIC_<APP>_URL via
// portless; preview/prod resolve through @vercel/related-projects.
export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: process.env.NEXT_PUBLIC_APP_URL ?? "https://lightfast.ai",
});

export const wwwUrl = withRelatedProject({
  projectName: "lightfast-www",
  defaultHost: process.env.NEXT_PUBLIC_WWW_URL ?? "https://lightfast.ai",
});

export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost:
    process.env.NEXT_PUBLIC_PLATFORM_URL ?? "https://lightfast-platform.vercel.app",
});
