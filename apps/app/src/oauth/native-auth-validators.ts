import {
  type NativeClient,
  nativeClientSchema,
  nativeCreateAttemptInputSchema,
} from "@repo/native-auth-contract";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";

export function isLoopbackRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    const port = Number.parseInt(url.port, 10);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.pathname === "/callback" &&
      Number.isInteger(port) &&
      port > 0
    );
  } catch {
    return false;
  }
}

export const nativeAuthStartSearchSchema = z.object({
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  redirect_uri: z.string().url().refine(isLoopbackRedirectUri),
  state: z.string().min(16).max(256),
});

export const nativeCreateAttemptFormSchema = nativeAuthStartSearchSchema.extend(
  {
    client: nativeClientSchema,
    organization_id: z.string().min(1),
  }
);

export function validateNativeAuthStartSearch(search: Record<string, unknown>) {
  const parsed = nativeAuthStartSearchSchema.safeParse(flattenSearch(search));
  if (!parsed.success) {
    throw notFound();
  }
  return parsed.data;
}

export function toCreateAttemptInput(input: {
  client: NativeClient;
  code_challenge: string;
  code_challenge_method: "S256";
  organization_id: string;
  redirect_uri: string;
  state: string;
}) {
  return nativeCreateAttemptInputSchema.parse({
    client: input.client,
    codeChallenge: input.code_challenge,
    codeChallengeMethod: input.code_challenge_method,
    organizationId: input.organization_id,
    redirectUri: input.redirect_uri,
    stateNonce: input.state,
  });
}

function flattenSearch(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );
}
