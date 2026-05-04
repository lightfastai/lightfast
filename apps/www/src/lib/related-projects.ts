import { resolveRelatedProjectUrl } from "@lightfastai/dev-proxy/related-projects";

// Get the app URL dynamically based on environment
export const appUrl = resolveRelatedProjectUrl("lightfast-app");
