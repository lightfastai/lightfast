import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { McpAuthorizationInput } from "./mcp-consent-types";

const mcpAuthorizationInputSchema = z.object({
  clientId: z.string().min(1),
  codeChallenge: z.string().min(1),
  codeChallengeMethod: z.literal("S256"),
  organizationId: z.string().min(1),
  redirectUri: z.string().url(),
  resource: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

export const loadMcpConsentViewModel = createServerFn({ method: "GET" })
  .inputValidator(validateMcpAuthorizeSearchInput)
  .handler(async ({ data }) => {
    const [
      { getRequest, setResponseHeader },
      { auth },
      { getMcpConsentViewModel },
      { redirectToSignInForOAuth },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@vendor/clerk/server"),
      import("./mcp-consent.server"),
      import("./oauth-auth-redirect"),
    ]);

    const request = getRequest();
    const authState = await auth({ treatPendingAsSignedOut: false });
    if (!authState.userId) {
      redirectToSignInForOAuth(request.url);
    }
    setResponseHeader("cache-control", "private, no-store");
    return getMcpConsentViewModel(data);
  });

export const approveMcpAuthorization = createServerFn({ method: "POST" })
  .inputValidator(mcpAuthorizationInputSchema)
  .handler(async ({ data }) => {
    const { approveMcpAuthorizationRequest } = await import(
      "./mcp-consent.server"
    );
    return approveMcpAuthorizationRequest(
      data satisfies McpAuthorizationInput
    );
  });

export const denyMcpAuthorization = createServerFn({ method: "POST" })
  .inputValidator(mcpAuthorizationInputSchema)
  .handler(async ({ data }) => {
    const { denyMcpAuthorizationRequest } = await import(
      "./mcp-consent.server"
    );
    return denyMcpAuthorizationRequest(
      data satisfies McpAuthorizationInput
    );
  });

function validateMcpAuthorizeSearchInput(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid OAuth authorization search input");
  }

  const record = input as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) =>
      typeof value === "string" && value.length > 0 ? [[key, value]] : []
    )
  ) as Record<string, string | undefined>;
}
