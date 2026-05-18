import { withRelatedProject } from "@vercel/related-projects";
import { env } from "~/env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

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

// Dev-only CORS allowlist: hostnames of the injected sibling URLs. Edge-safe.
export const devOriginPatterns: readonly string[] = isLocal
  ? Array.from(
      new Set(
        [appUrl, wwwUrl, platformUrl]
          .map((u) => {
            try {
              return new URL(u).host;
            } catch {
              return "";
            }
          })
          .filter((host) => host && host !== "lightfast.ai")
      )
    )
  : [];
