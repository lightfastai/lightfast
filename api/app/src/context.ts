import { randomUUID } from "node:crypto";

export interface ApiContext {
  now: () => Date;
  requestId: string;
}

export interface CreateApiContextOptions {
  now?: () => Date;
  requestId?: string;
}

export function createApiContext(
  options: CreateApiContextOptions = {}
): ApiContext {
  return {
    now: options.now ?? (() => new Date()),
    requestId: options.requestId ?? randomUUID(),
  };
}
