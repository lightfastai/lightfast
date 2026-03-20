import { withRelatedProject } from "@vercel/related-projects";
import { env } from "~/env";

const isDevelopment =
  env.NEXT_PUBLIC_VERCEL_ENV !== "production" &&
  env.NEXT_PUBLIC_VERCEL_ENV !== "preview";

// The app (lightfast.ai) — makes tRPC calls to platform
export const appUrl = withRelatedProject({
  projectName: "lightfast-app",
  defaultHost: isDevelopment ? "http://localhost:3024" : "https://lightfast.ai",
});
