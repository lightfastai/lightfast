// Short-lived (~30s TTL) one-shot store for in-flight desktop OAuth-style codes.
// Holds a Clerk JWT briefly while the desktop app exchanges code+verifier for it.
// Upstash provides at-rest encryption + TLS in transit; the entry is consumed
// atomically via GETDEL on first read.
import { randomBytes } from "node:crypto";
import { redis } from "@vendor/upstash";

const PREFIX = "desktop_auth_code:";
const TTL_SECONDS = 30;

export interface CodeRecord {
  userId: string;
  jwt: string;
  state: string;
  codeChallenge: string;
  redirectUri: string;
}

export async function issueCode(record: CodeRecord): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await redis.set(`${PREFIX}${code}`, record, { ex: TTL_SECONDS });
  return code;
}

export async function consumeCode(code: string): Promise<CodeRecord | null> {
  const result = await redis.getdel<CodeRecord>(`${PREFIX}${code}`);
  return result ?? null;
}
