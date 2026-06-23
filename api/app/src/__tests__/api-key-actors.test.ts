import { describe, expect, it } from "vitest";
import { actorFromApiKeyAuth } from "../auth/actors";
import type { ApiKeyAuthResult } from "../auth/api-key";
import type { AuthIdentity } from "../auth/identity";

const boundIdentity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

describe("actorFromApiKeyAuth", () => {
  it("creates an org-scoped API-key actor with creator attribution", () => {
    const auth: ApiKeyAuthResult = {
      apiKeyId: "key_test",
      identity: boundIdentity,
      scopes: ["api.signals.read"],
    };

    expect(actorFromApiKeyAuth(auth)).toEqual({
      createdByUserId: "user_test",
      keyId: "key_test",
      kind: "apiKey",
      orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
      orgId: "org_test",
      scopes: ["api.signals.read"],
    });
  });
});
