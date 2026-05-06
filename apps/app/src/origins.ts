import { getPortlessProxyOrigins } from "@lightfastai/dev-proxy/next";
import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "./env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

// Self-URL: lightfast-app is not in its own apps/app/vercel.json relatedProjects,
// so withRelatedProject returns defaultHost in every environment. The isLocal
// branch swaps the dev portless URL for the prod literal.
export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-app")
    : "https://lightfast.ai",
});

// Sibling URLs: VRP is populated on Vercel deploys, so withRelatedProject returns
// the matched URL; in dev VRP is empty, so defaultHost (portless) wins.
export const wwwUrl = withRelatedProject({
  projectName: "lightfast-www",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-www")
    : "https://lightfast.ai",
});

// platform is intentionally not on portless (raw :4112 in dev) — see CLAUDE.md
// "platform → http://localhost:4112 (raw backend; not yet on Portless / MFE)".
export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: isLocal
    ? "http://localhost:4112"
    : "https://lightfast-platform.vercel.app",
});

export const devOriginPatterns: readonly string[] = isLocal
  ? getPortlessProxyOrigins({ allowMissingConfig: true })
  : [];
