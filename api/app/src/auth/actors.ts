import type { Actor } from "../domain/actor";
import type { ApiKeyAuthResult } from "./api-key";

export function actorFromApiKeyAuth(auth: ApiKeyAuthResult): Actor {
  return {
    createdByUserId: auth.identity.userId,
    keyId: auth.apiKeyId,
    kind: "apiKey",
    orgGate: auth.identity.orgGate,
    orgId: auth.identity.orgId,
    scopes: auth.scopes,
  };
}
