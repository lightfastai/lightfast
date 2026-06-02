import { createHash } from "node:crypto";
import type { ConnectableConnectorProvider } from "@repo/connector-contract";
import { nanoid } from "@vendor/lib";
import { redis } from "@vendor/upstash";
import { z } from "zod";

const OAUTH_PREFIX = "connector-oauth-attempt:";
const TTL_SECONDS = 15 * 60;

const stateEnvelopeSchema = z.object({
  attemptId: z.string().min(16),
  nonce: z.string().min(16),
});

export interface ConnectorOAuthAttemptRecord {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  mode: "connect" | "reconnect";
  orgSlug: string;
  provider: ConnectableConnectorProvider;
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

function getAttemptKey(input: {
  provider: ConnectableConnectorProvider;
  state: string;
}) {
  const envelope = decodeState(input.state);
  return envelope
    ? `${OAUTH_PREFIX}${input.provider}:${envelope.attemptId}`
    : null;
}

function isMatchingAttempt(input: {
  provider: ConnectableConnectorProvider;
  record: ConnectorOAuthAttemptRecord | null;
  state: string;
}) {
  return (
    !!input.record &&
    input.record.provider === input.provider &&
    input.record.stateHash === hashState(input.state)
  );
}

export async function issueConnectorOAuthAttempt(input: {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  mode: "connect" | "reconnect";
  orgSlug: string;
  provider: ConnectableConnectorProvider;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: ConnectorOAuthAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    codeVerifier: input.codeVerifier,
    lightfastUserId: input.lightfastUserId,
    mode: input.mode,
    orgSlug: input.orgSlug,
    provider: input.provider,
    stateHash: hashState(state),
  };
  await redis.set(`${OAUTH_PREFIX}${input.provider}:${attemptId}`, record, {
    ex: TTL_SECONDS,
  });
  return { attemptId, state };
}

export async function lookupConnectorOAuthAttempt(input: {
  provider: ConnectableConnectorProvider;
  state: string;
}): Promise<ConnectorOAuthAttemptRecord | null> {
  const key = getAttemptKey(input);
  if (!key) {
    return null;
  }

  const record = await redis.get<ConnectorOAuthAttemptRecord>(key);
  return isMatchingAttempt({
    provider: input.provider,
    record,
    state: input.state,
  })
    ? record
    : null;
}

export async function consumeConnectorOAuthAttempt(input: {
  provider: ConnectableConnectorProvider;
  state: string;
}): Promise<ConnectorOAuthAttemptRecord | null> {
  const key = getAttemptKey(input);
  if (!key) {
    return null;
  }

  const pendingRecord = await redis.get<ConnectorOAuthAttemptRecord>(key);
  if (
    !isMatchingAttempt({
      provider: input.provider,
      record: pendingRecord,
      state: input.state,
    })
  ) {
    return null;
  }

  const consumedRecord = await redis.getdel<ConnectorOAuthAttemptRecord>(key);
  return isMatchingAttempt({
    provider: input.provider,
    record: consumedRecord,
    state: input.state,
  })
    ? consumedRecord
    : null;
}
