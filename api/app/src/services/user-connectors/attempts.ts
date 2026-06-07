import { nanoid } from "@vendor/lib";
import { redis } from "@vendor/upstash";
import { z } from "zod";

const OAUTH_PREFIX = "user-connector-oauth-attempt:";
const TTL_SECONDS = 15 * 60;

const userConnectorOAuthAttemptRecordSchema = z.object({
  attemptId: z.string().min(16),
  clerkUserId: z.string().min(1),
  clientInformation: z.unknown().optional(),
  codeVerifier: z.string().min(1).optional(),
  createdAt: z.string().min(1),
  provider: z.literal("granola"),
  redirectUrl: z.string().url(),
  returnTo: z.string().min(1),
});

export type UserConnectorOAuthAttemptRecord = z.infer<
  typeof userConnectorOAuthAttemptRecordSchema
>;

function keyForState(state: string) {
  return `${OAUTH_PREFIX}${state}`;
}

function parseAttemptRecord(
  record: unknown
): UserConnectorOAuthAttemptRecord | null {
  const parsed = userConnectorOAuthAttemptRecordSchema.safeParse(record);
  return parsed.success ? parsed.data : null;
}

export async function issueUserConnectorOAuthAttempt(input: {
  clerkUserId: string;
  clientInformation?: unknown;
  codeVerifier?: string;
  provider: "granola";
  redirectUrl: string;
  returnTo: string;
  state?: string;
}) {
  const attemptId = nanoid(32);
  const state = input.state ?? attemptId;
  const record = userConnectorOAuthAttemptRecordSchema.parse({
    attemptId,
    clerkUserId: input.clerkUserId,
    clientInformation: input.clientInformation,
    codeVerifier: input.codeVerifier,
    createdAt: new Date().toISOString(),
    provider: input.provider,
    redirectUrl: input.redirectUrl,
    returnTo: input.returnTo,
  });

  await redis.set(keyForState(state), record, { ex: TTL_SECONDS });
  return { attemptId, record, state };
}

export async function lookupUserConnectorOAuthAttempt(input: {
  state: string;
}): Promise<UserConnectorOAuthAttemptRecord | null> {
  return parseAttemptRecord(await redis.get(keyForState(input.state)));
}

export async function consumeUserConnectorOAuthAttempt(input: {
  state: string;
}): Promise<UserConnectorOAuthAttemptRecord | null> {
  return parseAttemptRecord(await redis.getdel(keyForState(input.state)));
}
