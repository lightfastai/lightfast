import { withRelatedProject } from "@vercel/related-projects";
import { env } from "./env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

// Cross-app URLs. Edge-safe: no fs access, no NodeJS-only deps. In dev, the
// dev:app script injects NEXT_PUBLIC_<APP>_URL=$(portless get <name>.lightfast)
// — those become defaultHost. In preview/prod, withRelatedProject reads
// VERCEL_RELATED_PROJECTS and returns the matched alias.
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

// Dev-only CORS allowlist: hostnames of the injected sibling URLs. Each entry
// is an exact host (no wildcards) — the running worktree is the only one we
// admit. Edge-safe: pure URL parsing.
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
