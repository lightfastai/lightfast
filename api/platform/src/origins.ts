import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";
import { withRelatedProject } from "@vercel/related-projects";

import { env } from "./env";

const isLocal =
  env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";

export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-app")
    : "https://lightfast.ai",
});
