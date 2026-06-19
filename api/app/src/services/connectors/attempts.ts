import { createHash } from "node:crypto";
import type { ConnectableConnectorProvider } from "@repo/api-contract";
import { nanoid } from "@vendor/lib";
import { redis } from "@vendor/upstash";
import { z } from "zod";

const OAUTH_PREFIX = "connector-oauth-attempt:";
const LEGACY_OAUTH_PREFIX = "linear-connect-oauth-attempt:";
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

type LegacyConnectorOAuthAttemptRecord = Omit<
  ConnectorOAuthAttemptRecord,
  "provider"
>;

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

function getLegacyAttemptKey(input: { state: string }) {
  const envelope = decodeState(input.state);
  return envelope ? `${LEGACY_OAUTH_PREFIX}${envelope.attemptId}` : null;
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

function isMatchingLegacyAttempt(input: {
  record: LegacyConnectorOAuthAttemptRecord | null;
  state: string;
}) {
  return !!input.record && input.record.stateHash === hashState(input.state);
}

function isStoredLegacyConnectorOAuthAttemptRecord(
  record: LegacyConnectorOAuthAttemptRecord | null
): record is Omit<ConnectorOAuthAttemptRecord, "provider"> {
  return (
    !!record &&
    typeof record.clerkOrgId === "string" &&
    typeof record.codeVerifier === "string" &&
    typeof record.lightfastUserId === "string" &&
    (record.mode === "connect" || record.mode === "reconnect") &&
    typeof record.orgSlug === "string" &&
    typeof record.stateHash === "string"
  );
}

async function readLegacyConnectorOAuthAttempt(input: {
  provider: ConnectableConnectorProvider;
  state: string;
}): Promise<ConnectorOAuthAttemptRecord | null> {
  if (input.provider !== "linear") {
    return null;
  }

  const key = getLegacyAttemptKey(input);
  if (!key) {
    return null;
  }

  const record = await redis.get<LegacyConnectorOAuthAttemptRecord>(key);
  if (
    !(
      isMatchingLegacyAttempt({ record, state: input.state }) &&
      isStoredLegacyConnectorOAuthAttemptRecord(record)
    )
  ) {
    return null;
  }

  return {
    ...record,
    provider: input.provider,
  };
}

async function consumeLegacyConnectorOAuthAttempt(input: {
  provider: ConnectableConnectorProvider;
  state: string;
}): Promise<ConnectorOAuthAttemptRecord | null> {
  if (input.provider !== "linear") {
    return null;
  }

  const key = getLegacyAttemptKey(input);
  if (!key) {
    return null;
  }

  const pendingRecord = await redis.get<LegacyConnectorOAuthAttemptRecord>(key);
  if (
    !(
      isMatchingLegacyAttempt({ record: pendingRecord, state: input.state }) &&
      isStoredLegacyConnectorOAuthAttemptRecord(pendingRecord)
    )
  ) {
    return null;
  }

  const consumedRecord =
    await redis.getdel<LegacyConnectorOAuthAttemptRecord>(key);
  if (
    !(
      isMatchingLegacyAttempt({
        record: consumedRecord,
        state: input.state,
      }) && isStoredLegacyConnectorOAuthAttemptRecord(consumedRecord)
    )
  ) {
    return null;
  }

  return {
    ...consumedRecord,
    provider: input.provider,
  };
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
  if (
    isMatchingAttempt({
      provider: input.provider,
      record,
      state: input.state,
    })
  ) {
    return record;
  }

  return readLegacyConnectorOAuthAttempt(input);
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
    isMatchingAttempt({
      provider: input.provider,
      record: pendingRecord,
      state: input.state,
    })
  ) {
    const consumedRecord = await redis.getdel<ConnectorOAuthAttemptRecord>(key);
    if (
      isMatchingAttempt({
        provider: input.provider,
        record: consumedRecord,
        state: input.state,
      })
    ) {
      return consumedRecord;
    }
  }

  // Maintain temporary linear legacy-key fallback while existing 15-minute attempts drain.
  return consumeLegacyConnectorOAuthAttempt(input);
}
