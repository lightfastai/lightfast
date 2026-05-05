import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "./env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

/** The app (lightfast.ai) — OAuth callbacks and webhook ingest route through here. */
export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-app")
    : "https://lightfast.ai",
});
