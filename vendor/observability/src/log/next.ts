import "server-only";

import { log as logtail } from "@logtail/next";
import { getContext, pushJournal } from "../context";
import { betterstackEnv } from "../env/betterstack";

const shouldUseBetterStack = betterstackEnv.VERCEL_ENV === "production";

const baseLog = shouldUseBetterStack ? logtail : console;

type LogLevel = "info" | "warn" | "error" | "debug";

function enriched(level: LogLevel) {
  return (msg: string, meta?: Record<string, unknown>) => {
    pushJournal(level, msg, meta);
    baseLog[level](msg, { ...getContext(), ...meta });
  };
}

export const log = {
  info: enriched("info"),
  warn: enriched("warn"),
  error: enriched("error"),
  debug: enriched("debug"),
};

export type Logger = typeof log;
