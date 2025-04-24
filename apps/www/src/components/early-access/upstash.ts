import { Redis } from "@upstash/redis";
import { ResultAsync } from "neverthrow";

import { env } from "~/env";

// Constants
const WAITLIST_COUNT_KEY = "waitlist:count";

// Error classes
export class UpstashError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "UpstashError";
  }
}

export class UpstashRateLimitError extends UpstashError {
  constructor(
    message: string,
    public retryAfter?: string,
  ) {
    super(message);
    this.name = "UpstashRateLimitError";
  }
}

export class UpstashAuthenticationError extends UpstashError {
  constructor(message: string) {
    super(message, 401);
    this.name = "UpstashAuthenticationError";
  }
}

export class UpstashConnectionError extends UpstashError {
  constructor(message: string) {
    super(message, 503);
    this.name = "UpstashConnectionError";
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

export class UpstashEarlyAccessCountError extends Error {
  constructor(
    message: string,
    public originalError: UpstashError | Error,
  ) {
    super(message);
    this.name = "UpstashWaitlistError";
  }
}

// Union type of all possible Upstash errors
export type UpstashFuncError =
  | UpstashRateLimitError
  | UpstashAuthenticationError
  | UpstashConnectionError
  | UpstashError
  | UnknownError
  | UpstashEarlyAccessCountError;

// Initialize Redis client
const redis = new Redis({
  url: env.KV_REST_API_URL,
  token: env.KV_REST_API_TOKEN,
});

// Unsafe operations that can throw
const incrementWaitlistCountUnsafe = async (): Promise<number> => {
  try {
    const count = await redis.incr(WAITLIST_COUNT_KEY);
    return count;
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific Redis errors
      if (error.message.includes("READONLY")) {
        throw new UpstashConnectionError("Redis is in read-only mode");
      }
      if (error.message.includes("LOADING")) {
        throw new UpstashConnectionError(
          "Redis is loading the dataset in memory",
        );
      }
      if (error.message.includes("auth")) {
        throw new UpstashAuthenticationError("Invalid Redis credentials");
      }
      if (error.message.includes("rate limit")) {
        throw new UpstashRateLimitError(
          "Rate limit exceeded",
          error instanceof Error && "retryAfter" in error
            ? (error as { retryAfter: string }).retryAfter
            : "60s",
        );
      }
      throw new UpstashError(error.message);
    }
    throw new UnknownError("Unknown error while incrementing waitlist count");
  }
};

const getWaitlistCountUnsafe = async (): Promise<number> => {
  try {
    const count = await redis.get<number>(WAITLIST_COUNT_KEY);
    return count ?? 0;
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific Redis errors
      if (error.message.includes("READONLY")) {
        throw new UpstashConnectionError("Redis is in read-only mode");
      }
      if (error.message.includes("LOADING")) {
        throw new UpstashConnectionError(
          "Redis is loading the dataset in memory",
        );
      }
      if (error.message.includes("auth")) {
        throw new UpstashAuthenticationError("Invalid Redis credentials");
      }
      if (error.message.includes("rate limit")) {
        throw new UpstashRateLimitError(
          "Rate limit exceeded",
          error instanceof Error && "retryAfter" in error
            ? (error as { retryAfter: string }).retryAfter
            : "60s",
        );
      }
      throw new UpstashError(error.message);
    }
    throw new UnknownError("Unknown error while getting waitlist count");
  }
};

// Safe operations that return Result types
export const incrementWaitlistCountSafe = () =>
  ResultAsync.fromPromise(
    incrementWaitlistCountUnsafe(),
    (error): UpstashEarlyAccessCountError => {
      if (
        error instanceof UpstashRateLimitError ||
        error instanceof UpstashAuthenticationError ||
        error instanceof UpstashConnectionError ||
        error instanceof UpstashError
      ) {
        return new UpstashEarlyAccessCountError(error.message, error);
      }
      return new UpstashEarlyAccessCountError(
        "Failed to increment waitlist count",
        error instanceof Error ? error : new Error("Unknown error"),
      );
    },
  );

export const getWaitlistCountSafe = () =>
  ResultAsync.fromPromise(
    getWaitlistCountUnsafe(),
    (error): UpstashEarlyAccessCountError => {
      if (
        error instanceof UpstashRateLimitError ||
        error instanceof UpstashAuthenticationError ||
        error instanceof UpstashConnectionError ||
        error instanceof UpstashError
      ) {
        return new UpstashEarlyAccessCountError(error.message, error);
      }
      return new UpstashEarlyAccessCountError(
        "Failed to get waitlist count",
        error instanceof Error ? error : new Error("Unknown error"),
      );
    },
  );
