import "server-only";

import { log as logtail } from "@logtail/next";
import { betterstackEnv } from "../env/betterstack";

const shouldUseBetterStack = betterstackEnv.VERCEL_ENV === "production";

export const log = shouldUseBetterStack ? logtail : console;

export type Logger = typeof log;
