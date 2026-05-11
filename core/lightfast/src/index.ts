import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { apiContract, type Contract } from "@repo/api-contract";

declare const __SDK_VERSION__: string;

export interface LightfastOptions {
  /** API base URL. Defaults to `https://lightfast.ai`. */
  baseUrl?: string;
  /** Custom fetch implementation (for testing or proxying). */
  fetch?: typeof fetch;
}

export type LightfastClient = ContractRouterClient<Contract>;

export function createLightfast(
  apiKey: string,
  options: LightfastOptions = {}
): LightfastClient {
  if (!apiKey?.startsWith("sk-lf-")) {
    throw new Error("Invalid Lightfast API key");
  }

  const baseUrl = options.baseUrl ?? "https://lightfast.ai";
  // Strip trailing slash and any trailing /api/v1 so callers can pass either form.
  const normalizedBase = baseUrl.replace(/\/$/, "").replace(/\/api\/v1$/, "");

  const link = new OpenAPILink(apiContract, {
    url: `${normalizedBase}/api/v1`,
    headers: () => ({
      authorization: `Bearer ${apiKey}`,
    }),
    ...(options.fetch && { fetch: options.fetch }),
  });

  return createORPCClient(link);
}

export const VERSION: string = __SDK_VERSION__;
export type { Contract } from "@repo/api-contract";
