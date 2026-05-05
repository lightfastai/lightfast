import {
  resolveProjectUrl,
  withProject,
} from "@lightfastai/dev-proxy/projects";
import { env } from "../env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
const isLocal = vercelEnv !== "production" && vercelEnv !== "preview";

function throwMissingVrp(projectName: string): never {
  throw new Error(
    `VERCEL_RELATED_PROJECTS missing "${projectName}" on this preview deploy. ` +
      `Declare it in apps/app/vercel.json relatedProjects and ensure ${projectName} also deploys on this branch.`
  );
}

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
    throwMissingVrp(projectName);
  }
  return url;
}

function resolveStandalone(
  projectName: string,
  productionFallback: string,
  devFallback: string
): string {
  if (isLocal) {
    return devFallback;
  }
  const url = withProject({
    projectName,
    defaultHost: vercelEnv === "production" ? productionFallback : "",
  });
  if (!url) {
    throwMissingVrp(projectName);
  }
  return url;
}

export const wwwUrl = resolveSibling("lightfast-www", "https://lightfast.ai");
export const platformUrl = resolveStandalone(
  "lightfast-platform",
  "https://lightfast-platform.vercel.app",
  "http://localhost:4112"
);

// Self-URL: in dev, the portless host (https://app.lightfast.localhost/);
// in preview/prod, the production host (microfrontends serves under one domain).
export const appUrl = isLocal
  ? resolveProjectUrl("lightfast-app")
  : "https://lightfast.ai";
