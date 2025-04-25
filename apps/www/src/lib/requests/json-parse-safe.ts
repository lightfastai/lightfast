import type { Result } from "neverthrow";
import type { NextRequest } from "next/server";
import { err, ok } from "neverthrow";

import { log } from "@vendor/observability/log";

export class InvalidJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidJsonError";
  }
}

export const jsonParseSafe = async <T>(
  request: NextRequest,
): Promise<Result<T, Error>> => {
  try {
    return ok((await request.json()) as T);
  } catch (error: unknown) {
    log.error("Error: Could not parse JSON:", { error });
    return err(new InvalidJsonError("Invalid JSON"));
  }
};
