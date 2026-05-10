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

export const wwwUrl = withRelatedProject({
  projectName: "lightfast-www",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-www")
    : "https://lightfast.ai",
});

export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-platform")
    : "https://lightfast-platform.vercel.app",
});
