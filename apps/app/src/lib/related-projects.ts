import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "../env";

const isDevelopment =
  env.NEXT_PUBLIC_VERCEL_ENV !== "production" &&
  env.NEXT_PUBLIC_VERCEL_ENV !== "preview";

// Get the www URL dynamically based on environment
export const wwwUrl = resolveProjectUrl("lightfast-www");

// Get the platform URL dynamically based on environment
export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: isDevelopment
    ? "http://localhost:4112"
    : "https://lightfast-platform.vercel.app",
});
