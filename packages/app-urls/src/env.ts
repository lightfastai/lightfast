import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    // Port numbers for development
    NEXT_PUBLIC_WWW_PORT: z.coerce.number().default(4101),
    NEXT_PUBLIC_WWW_SEARCH_PORT: z.coerce.number().default(4105),
    NEXT_PUBLIC_AUTH_PORT: z.coerce.number().default(4104),
    NEXT_PUBLIC_CHAT_PORT: z.coerce.number().default(4106),
    NEXT_PUBLIC_CONSOLE_PORT: z.coerce.number().default(4107),
    NEXT_PUBLIC_DOCS_PORT: z.coerce.number().default(3002),
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]).default("development"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_WWW_PORT: process.env.NEXT_PUBLIC_WWW_PORT,
    NEXT_PUBLIC_WWW_SEARCH_PORT: process.env.NEXT_PUBLIC_WWW_SEARCH_PORT,
    NEXT_PUBLIC_AUTH_PORT: process.env.NEXT_PUBLIC_AUTH_PORT,
    NEXT_PUBLIC_CHAT_PORT: process.env.NEXT_PUBLIC_CHAT_PORT,
    NEXT_PUBLIC_CONSOLE_PORT: process.env.NEXT_PUBLIC_CONSOLE_PORT,
    NEXT_PUBLIC_DOCS_PORT: process.env.NEXT_PUBLIC_DOCS_PORT,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
