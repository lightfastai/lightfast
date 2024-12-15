import { log as logtail } from "@logtail/next";

import { env } from "../env";

export const log = env.APP_ENV !== "dev" ? logtail : console;

export type Logger = typeof log;
