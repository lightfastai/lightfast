import * as Sentry from "@sentry/core";
import { log } from "../log/edge";

export const parseError = (error: unknown): string => {
  let message = "An error occurred";

  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    message = error.message as string;
  } else if (typeof error === "string") {
    message = error;
  } else {
    message = String(error);
  }

  try {
    Sentry.captureException(error);
    log.error(`Parsing error: ${message}`);
  } catch (newError) {
    console.error("Error parsing error:", newError);
  }

  return message;
};
