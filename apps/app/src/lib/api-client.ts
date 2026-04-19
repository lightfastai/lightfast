import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { apiContract } from "@repo/app-api-contract";

export type ApiClient = JsonifiedClient<
  ContractRouterClient<typeof apiContract>
>;

/**
 * Create a session-authenticated oRPC client for calling /v1/* endpoints
 * from the browser. Uses Clerk session cookies for auth and X-Org-ID header
 * for org scoping.
 */
export function createApiClient(clerkOrgId: string): ApiClient {
  const link = new OpenAPILink(apiContract, {
    url: typeof window === "undefined" ? "" : window.location.origin,
    headers: { "x-org-id": clerkOrgId },
    fetch: (request, init) =>
      fetch(request, { ...init, credentials: "include" }),
  });

  return createORPCClient(link) as ApiClient;
}
