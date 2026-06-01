import { createHash } from "node:crypto";
import { nanoid } from "@vendor/lib";
import { redis } from "@vendor/upstash";
import { z } from "zod";

const OAUTH_PREFIX = "linear-connect-oauth-attempt:";
const TTL_SECONDS = 15 * 60;

const stateEnvelopeSchema = z.object({
  attemptId: z.string().min(16),
  nonce: z.string().min(16),
});

export interface LinearConnectOAuthAttemptRecord {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  mode: "connect" | "reconnect";
  orgSlug: string;
  stateHash: string;
}

function encodeState(input: { attemptId: string; nonce: string }): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeState(
  state: string
): { attemptId: string; nonce: string } | null {
  try {
    return stateEnvelopeSchema.parse(
      JSON.parse(Buffer.from(state, "base64url").toString("utf8"))
    );
  } catch {
    return null;
  }
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

function getAttemptKey(state: string) {
  const envelope = decodeState(state);
  return envelope ? `${OAUTH_PREFIX}${envelope.attemptId}` : null;
}

function isMatchingAttempt(
  record: LinearConnectOAuthAttemptRecord | null,
  state: string
) {
  return !!record && record.stateHash === hashState(state);
}

export async function issueLinearConnectOAuthAttempt(input: {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  mode: "connect" | "reconnect";
  orgSlug: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: LinearConnectOAuthAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    codeVerifier: input.codeVerifier,
    lightfastUserId: input.lightfastUserId,
    mode: input.mode,
    orgSlug: input.orgSlug,
    stateHash: hashState(state),
  };
  await redis.set(`${OAUTH_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}

export async function lookupLinearConnectOAuthAttempt(input: {
  state: string;
}): Promise<LinearConnectOAuthAttemptRecord | null> {
  const key = getAttemptKey(input.state);
  if (!key) {
    return null;
  }

  const record = await redis.get<LinearConnectOAuthAttemptRecord>(key);
  return isMatchingAttempt(record, input.state) ? record : null;
}

export async function consumeLinearConnectOAuthAttempt(input: {
  state: string;
}): Promise<LinearConnectOAuthAttemptRecord | null> {
  const key = getAttemptKey(input.state);
  if (!key) {
    return null;
  }

  const pendingRecord = await redis.get<LinearConnectOAuthAttemptRecord>(key);
  if (!isMatchingAttempt(pendingRecord, input.state)) {
    return null;
  }

  const consumedRecord =
    await redis.getdel<LinearConnectOAuthAttemptRecord>(key);
  return isMatchingAttempt(consumedRecord, input.state) ? consumedRecord : null;
}
