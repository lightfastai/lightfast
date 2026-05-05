import {
  resolveProjectUrl,
  withProject,
} from "@lightfastai/dev-proxy/projects";
import { env } from "../env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

function resolveSibling(
  projectName: string,
  productionFallback: string
): string {
  if (isLocal) {
    return resolveProjectUrl(projectName);
  }
  const url = withProject({
    projectName,
    defaultHost: vercelEnv === "production" ? productionFallback : "",
  });
  if (!url) {
    throw new Error(
      `VERCEL_RELATED_PROJECTS missing "${projectName}" on this preview deploy. ` +
        `Declare it in apps/platform/vercel.json relatedProjects and ensure ${projectName} also deploys on this branch.`
    );
  }
  return url;
}

/** The app (lightfast.ai) — OAuth callbacks and webhook ingest route through here. */
export const appUrl = resolveSibling("lightfast-app", "https://lightfast.ai");
