import { withRelatedProject } from "@vercel/related-projects";
import { env } from "./env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

// Cross-app URLs. Edge-safe: no fs access, no NodeJS-only deps. In dev,
// portless injects NEXT_PUBLIC_<APP>_URL=$(portless get <name>.lightfast).
// Those values become defaultHost. In preview/prod, withRelatedProject reads
// VERCEL_RELATED_PROJECTS and returns the matched alias.
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

// Dev-only CORS allowlist: the full host (port included) of each sibling URL.
// We filter on `hostname` (port-stripped) so values like `http://localhost:3000`
// still match; production fallbacks never sneak in.
export const devOriginPatterns: readonly string[] = isLocal
  ? Array.from(
      new Set(
        [appUrl, wwwUrl, platformUrl].flatMap((u) => {
          try {
            const { host, hostname } = new URL(u);
            return hostname === "localhost" || hostname.endsWith(".localhost")
              ? [host]
              : [];
          } catch {
            return [];
          }
        })
      )
    )
  : [];
