import { log as logtail } from "@logtail/next";
import { betterstackEnv } from "./env/betterstack-env";

// Use BetterStack (Logtail) for production and preview environments
// Use console.log for development and local environments
const shouldUseBetterStack = 
  betterstackEnv.NEXT_PUBLIC_VERCEL_ENV === "production" || 
  betterstackEnv.NEXT_PUBLIC_VERCEL_ENV === "preview";

export const log = shouldUseBetterStack ? logtail : console;

export type Logger = typeof log;
