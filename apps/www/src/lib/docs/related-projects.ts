import { env } from "~/env";

const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;

export const wwwUrl = ""; // same origin — use relative paths

export const consoleUrl =
  vercelEnv === "production"
    ? "https://app.lightfast.ai"
    : vercelEnv === "preview"
      ? "https://app-staging.lightfast.ai"
      : "http://localhost:4107";
