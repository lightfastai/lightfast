import { TRPCError } from "@trpc/server";
import { env } from "../../env";

export interface SentryAuthBoxStartResult {
  attemptId: string;
  expiresAt: Date;
  userCode: string;
  verificationUri: string;
}

export interface SentryAuthBoxCompleteResult {
  expiresAt: Date | null;
  providerAccountId: string;
  providerAccountName: string;
  scopes: string[];
  token: string;
}

export interface SentryAuthBoxClient {
  start(input: {
    clerkOrgId: string;
    actorUserId: string;
    providerAccountName: string;
  }): Promise<SentryAuthBoxStartResult>;
  complete(input: {
    attemptId: string;
    clerkOrgId: string;
    actorUserId: string;
  }): Promise<SentryAuthBoxCompleteResult>;
}

function authBoxConfig() {
  if (!env.DEVELOPER_AUTH_BOX_ORIGIN || !env.DEVELOPER_AUTH_BOX_TOKEN) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Developer auth box is not configured.",
    });
  }
  return {
    origin: env.DEVELOPER_AUTH_BOX_ORIGIN.replace(/\/$/, ""),
    token: env.DEVELOPER_AUTH_BOX_TOKEN,
  };
}

async function authBoxRequest<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const config = authBoxConfig();
  const response = await fetch(`${config.origin}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Developer auth box request failed with ${response.status}.`,
    });
  }

  return (await response.json()) as T;
}

function parseDate(value: string | null) {
  return value ? new Date(value) : null;
}

export const sentryAuthBoxClient: SentryAuthBoxClient = {
  async start(input) {
    const result = await authBoxRequest<{
      attemptId: string;
      expiresAt: string;
      userCode: string;
      verificationUri: string;
    }>("/v1/sentry/device-code/start", input);
    return { ...result, expiresAt: new Date(result.expiresAt) };
  },
  async complete(input) {
    const result = await authBoxRequest<{
      expiresAt: string | null;
      providerAccountId: string;
      providerAccountName: string;
      scopes: string[];
      token: string;
    }>("/v1/sentry/device-code/complete", input);
    return { ...result, expiresAt: parseDate(result.expiresAt) };
  },
};
