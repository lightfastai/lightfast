import { withRelatedProject } from "@vercel/related-projects";
import { env } from "~/env";

const isDevelopment =
  env.NEXT_PUBLIC_VERCEL_ENV !== "production" &&
  env.NEXT_PUBLIC_VERCEL_ENV !== "preview";

// Get the console (app) URL dynamically based on environment
export const consoleUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isDevelopment ? "http://localhost:4107" : "https://lightfast.ai",
});
