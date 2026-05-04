import { resolveProjectUrl } from "@lightfastai/dev-proxy/projects";

// Get the app URL dynamically based on environment
export const appUrl = resolveProjectUrl("lightfast-app");
