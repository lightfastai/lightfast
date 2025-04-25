import { log as logtail } from "@logtail/next";

import { betterstackEnv } from "../env";

// Will use Logtail when running on Vercel (production/preview)
// Will use console.log when running locally
export const log = betterstackEnv.VERCEL ? logtail : console;

export type Logger = typeof log;
