import { withRelatedProject } from "@vercel/related-projects";

import { env } from "./env";

const isLocal = env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";
const APP_PRODUCTION_URL = "https://lightfast.ai";

function localDefaultHost(envName: string): string {
  const value = process.env[envName];
  if (value) {
    return value;
  }
  throw new Error(
    `${envName} is required for local origin resolution. Run pnpm dev so portless injects local origins.`
  );
}

function defaultHost(envName: string, productionUrl: string): string {
  return isLocal ? localDefaultHost(envName) : productionUrl;
}

export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: defaultHost("NEXT_PUBLIC_APP_URL", APP_PRODUCTION_URL),
});

export const wwwUrl = withRelatedProject({
  projectName: "lightfast-www",
  defaultHost: defaultHost("NEXT_PUBLIC_WWW_URL", APP_PRODUCTION_URL),
});
