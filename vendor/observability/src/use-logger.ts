import { useLogger as useLogtailLogger } from "@logtail/next";

import type { Logger } from "./types";

export const useLogger = (): Logger => {
  const logger = useLogtailLogger();

  return {
    debug: (message: string, metadata?: Record<string, unknown>) =>
      logger.debug(message, metadata),
    info: (message: string, metadata?: Record<string, unknown>) =>
      logger.info(message, metadata),
    warn: (message: string, metadata?: Record<string, unknown>) =>
      logger.warn(message, metadata),
    error: (message: string, metadata?: Record<string, unknown>) =>
      logger.error(message, metadata),
  };
};
