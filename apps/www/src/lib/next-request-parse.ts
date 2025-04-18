import type { Result } from "neverthrow";
import type { NextRequest } from "next/server";
import { err, ok } from "neverthrow";

export class InvalidJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidJsonError";
  }
}

export const safeJsonParse = async <T>(
  request: NextRequest,
): Promise<Result<T, Error>> => {
  try {
    return ok((await request.json()) as T);
  } catch (error: unknown) {
    console.error("Error: Could not parse JSON:", error);
    return err(new InvalidJsonError("Invalid JSON"));
  }
};
