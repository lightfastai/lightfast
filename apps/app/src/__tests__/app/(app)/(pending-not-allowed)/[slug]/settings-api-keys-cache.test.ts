import { describe, expect, it } from "vitest";

import {
  removeApiKey,
  restoreApiKey,
  revokeApiKey,
  type OrgApiKeyListData,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-cache";

const activeKey: OrgApiKeyListData[number] = {
  claims: null,
  createdAt: 1_700_000_000_000,
  createdBy: "user_ada",
  description: null,
  expired: false,
  expiration: null,
  id: "ak_active",
  lastUsedAt: null,
  name: "Production",
  revoked: false,
  revocationReason: null,
  scopes: [],
  subject: "org_acme",
  type: "api_key",
  updatedAt: 1_700_000_000_000,
};

const revokedKey: OrgApiKeyListData[number] = {
  ...activeKey,
  id: "ak_revoked",
  name: "Revoked",
  revoked: true,
};

function keys(): OrgApiKeyListData {
  return [activeKey, revokedKey];
}

describe("org API key cache helpers", () => {
  it("marks a key revoked and can roll back the change", () => {
    const updated = revokeApiKey(keys(), "ak_active");

    expect(updated![0]).toMatchObject({
      id: "ak_active",
      revoked: true,
    });
    expect(revokeApiKey(keys(), "missing")).toEqual(keys());
    expect(revokeApiKey(undefined, "ak_active")).toBeUndefined();
  });

  it("removes and restores a key at the captured index", () => {
    const removed = removeApiKey(keys(), "ak_active");

    expect(removed.removedApiKey).toEqual(activeKey);
    expect(removed.removedIndex).toBe(0);
    expect(removed.data!.map((key) => key.id)).toEqual(["ak_revoked"]);

    expect(
      restoreApiKey(removed.data, removed.removedApiKey, removed.removedIndex)
    ).toEqual(keys());
  });
});
