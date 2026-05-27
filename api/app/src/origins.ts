import { withRelatedProject } from "@vercel/related-projects";

import { env } from "./env";

const isLocal = env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";
const APP_PRODUCTION_URL = "https://lightfast.ai";
const PLATFORM_PRODUCTION_URL = "https://lightfast-platform.vercel.app";

export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? (process.env.NEXT_PUBLIC_APP_URL ?? APP_PRODUCTION_URL)
    : APP_PRODUCTION_URL,
});

export const wwwUrl = withRelatedProject({
  projectName: "lightfast-www",
  defaultHost: isLocal
    ? (process.env.NEXT_PUBLIC_WWW_URL ?? APP_PRODUCTION_URL)
    : APP_PRODUCTION_URL,
});

export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: isLocal
    ? (process.env.NEXT_PUBLIC_PLATFORM_URL ?? PLATFORM_PRODUCTION_URL)
    : PLATFORM_PRODUCTION_URL,
});
