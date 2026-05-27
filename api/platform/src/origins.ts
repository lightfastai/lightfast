import { withRelatedProject } from "@vercel/related-projects";

import { env } from "./env";

const isLocal = env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";
const APP_PRODUCTION_URL = "https://lightfast.ai";

export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? (process.env.NEXT_PUBLIC_APP_URL ?? APP_PRODUCTION_URL)
    : APP_PRODUCTION_URL,
});
