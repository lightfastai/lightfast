import { resolveRelatedProjectUrl } from "@lightfastai/related-projects/related-projects";
import { withRelatedProject } from "@vercel/related-projects";

// Get the www URL dynamically based on environment
export const wwwUrl = resolveRelatedProjectUrl("lightfast-www");

// Get the platform URL dynamically based on environment
export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: resolveRelatedProjectUrl("lightfast-platform"),
});
