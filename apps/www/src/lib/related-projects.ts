import { resolveRelatedProjectUrl } from "@lightfastai/related-projects/related-projects";

// Get the app URL dynamically based on environment
export const appUrl = resolveRelatedProjectUrl("lightfast-app");
