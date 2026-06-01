import type { Database, McpOauthGrant } from "@db/app";
import {
  createMcpOauthGrant,
  getActiveMcpOauthGrant,
  revokeMcpOauthGrant,
} from "@db/app";
import type { McpScope } from "@repo/api-contract";

export interface FindOrCreateMcpOauthGrantInput {
  clerkOrgId: string;
  clerkUserId: string;
  clientPublicId: string;
  resource: string;
  scopes: McpScope[];
}

export async function findOrCreateMcpOauthGrant(
  db: Database,
  input: FindOrCreateMcpOauthGrantInput
): Promise<McpOauthGrant> {
  const existing = await getActiveMcpOauthGrant(db, input);
  if (existing) {
    return existing;
  }
  return await createMcpOauthGrant(db, input);
}

export async function revokeMcpGrant(
  db: Database,
  input: { publicId: string }
): Promise<boolean> {
  return await revokeMcpOauthGrant(db, input);
}
