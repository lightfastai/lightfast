import { createHash } from "node:crypto";

import type { NativeClient } from "@repo/native-auth-contract";
import { nanoid } from "@vendor/lib";
import { redis } from "@vendor/upstash";

const PREFIX = "native-auth-attempt:";
const TTL_SECONDS = 10 * 60;

export interface NativeAuthAttemptRecord {
  client: NativeClient;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  organizationId: string;
  redirectUri: string;
  stateHash: string;
  userId: string;
}

export interface IssueNativeAuthAttemptInput {
  client: NativeClient;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  organizationId: string;
  redirectUri: string;
  stateNonce: string;
  userId: string;
}

export interface IssuedNativeAuthAttempt {
  attemptId: string;
  state: string;
}

function encodeState(input: { attemptId: string; nonce: string }): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export async function issueNativeAuthAttempt(
  input: IssueNativeAuthAttemptInput
): Promise<IssuedNativeAuthAttempt> {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: input.stateNonce });
  const record: NativeAuthAttemptRecord = {
    client: input.client,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    organizationId: input.organizationId,
    redirectUri: input.redirectUri,
    stateHash: hashState(state),
    userId: input.userId,
  };

  await redis.set(`${PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });

  return { attemptId, state };
}

export async function consumeNativeAuthAttempt(input: {
  attemptId: string;
  state: string;
}): Promise<NativeAuthAttemptRecord | null> {
  const record = await redis.getdel<NativeAuthAttemptRecord>(
    `${PREFIX}${input.attemptId}`
  );

  if (!record || record.stateHash !== hashState(input.state)) {
    return null;
  }

  return record;
}
