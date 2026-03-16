import { Logtail } from "@logtail/edge";
import { betterstackEdgeEnv } from "../env/betterstack-edge";
import type { Logger } from "./types";

export { betterstackEdgeEnv } from "../env/betterstack-edge";
export type { Logger } from "./types";

export type EdgeLogger = Logger & { flush(): Promise<unknown> };

function fromLogtail(logger: Logtail): EdgeLogger {
  return {
    debug: (msg, meta) => void logger.debug(msg, meta as object),
    info: (msg, meta) => void logger.info(msg, meta as object),
    warn: (msg, meta) => void logger.warn(msg, meta as object),
    error: (msg, meta) => void logger.error(msg, meta as object),
    flush: () => logger.flush(),
  };
}

const token = betterstackEdgeEnv.BETTERSTACK_SOURCE_TOKEN;

export const log: EdgeLogger =
  token && betterstackEdgeEnv.VERCEL_ENV === "production"
    ? fromLogtail(
        new Logtail(token, {
          endpoint: betterstackEdgeEnv.BETTERSTACK_INGESTING_HOST,
        })
      )
    : { ...console, flush: () => Promise.resolve() };
