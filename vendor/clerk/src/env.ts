import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const clerkEnvBase = createEnv({
  shared: {},
  server: {
    CLERK_SECRET_KEY: z.string().min(1).startsWith("sk_"),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).startsWith("pk_"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

export function getClerkFrontendApi(): string {
  const base64Part =
    clerkEnvBase.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.split("_")[2];

  if (!base64Part) {
    return "";
  }

  try {
    const decoded = Buffer.from(base64Part, "base64").toString("utf-8");
    const domain = decoded.replace(/\$$/, "");
    return `https://${domain}`;
  } catch {
    return "";
  }
}
