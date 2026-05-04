import { withRelatedProject } from "@vercel/related-projects";

const isDevelopment =
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" &&
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview";

export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: isDevelopment
    ? "http://localhost:4112"
    : "https://lightfast-platform.vercel.app",
});
