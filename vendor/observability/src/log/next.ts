import "server-only";

import * as Sentry from "@sentry/nextjs";
import { getContext } from "../context";

type LogLevel = "info" | "warn" | "error" | "debug";
type SentryLogAttributes = Record<string, string | number | boolean>;

const MAX_ATTRIBUTE_LENGTH = 2000;

function truncate(value: string) {
  return value.length > MAX_ATTRIBUTE_LENGTH
    ? `${value.slice(0, MAX_ATTRIBUTE_LENGTH)}...`
    : value;
}

function normalizeAttribute(
  value: unknown
): string | number | boolean | undefined {
  if (value === undefined) {
    return;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value === "string" ? truncate(value) : value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value === null) {
    return "null";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return truncate(`${value.name}: ${value.message}`);
  }

  try {
    return truncate(JSON.stringify(value) ?? String(value));
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function normalizeAttributes(
  meta: Record<string, unknown>
): SentryLogAttributes {
  return Object.fromEntries(
    Object.entries(meta)
      .map(([key, value]) => [key, normalizeAttribute(value)] as const)
      .filter(
        (entry): entry is readonly [string, string | number | boolean] =>
          entry[1] !== undefined
      )
  );
}

function writeConsole(
  level: LogLevel,
  msg: string,
  meta: Record<string, unknown>
) {
  try {
    const transport = console[level] ?? console.log;
    if (Object.keys(meta).length === 0) {
      transport.call(console, msg);
      return;
    }
    transport.call(console, msg, meta);
  } catch {
    // Logging must not create app errors or recursive observability noise.
  }
}

function writeSentryLog(
  level: LogLevel,
  msg: string,
  meta: Record<string, unknown>
) {
  try {
    const attributes = normalizeAttributes(meta);
    switch (level) {
      case "debug":
        Sentry.logger.debug(msg, attributes);
        return;
      case "error":
        Sentry.logger.error(msg, attributes);
        return;
      case "info":
        Sentry.logger.info(msg, attributes);
        return;
      case "warn":
        Sentry.logger.warn(msg, attributes);
        return;
      default:
        return;
    }
  } catch {
    // Logging must not create app errors or recursive observability noise.
  }
}

function enriched(level: LogLevel) {
  return (msg: string, meta?: Record<string, unknown>) => {
    const enrichedMeta = { ...getContext(), ...(meta ?? {}) };
    writeConsole(level, msg, enrichedMeta);
    writeSentryLog(level, msg, enrichedMeta);
  };
}

export const log = {
  info: enriched("info"),
  warn: enriched("warn"),
  error: enriched("error"),
  debug: enriched("debug"),
};

export type Logger = typeof log;
