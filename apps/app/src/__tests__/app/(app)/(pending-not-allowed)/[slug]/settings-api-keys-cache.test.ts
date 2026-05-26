import { describe, expect, it } from "vitest";

import {
  type OrgApiKeyListData,
  removeApiKey,
  restoreApiKey,
  revokeApiKey,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-cache";

const activeKey: OrgApiKeyListData[number] = {
  createdAt: 1_700_000_000_000,
  enabled: true,
  keyId: "key_active",
  name: "Production",
  start: "ak_active",
  updatedAt: 1_700_000_000_000,
};

const revokedKey: OrgApiKeyListData[number] = {
  ...activeKey,
  enabled: false,
  keyId: "key_revoked",
  name: "Revoked",
  start: "ak_revoked",
};

function keys(): OrgApiKeyListData {
  return [activeKey, revokedKey];
}

describe("org API key cache helpers", () => {
  it("marks a key revoked and can roll back the change", () => {
    const updated = revokeApiKey(keys(), "key_active");

    expect(updated![0]).toMatchObject({
      enabled: false,
      keyId: "key_active",
    });
    expect(revokeApiKey(keys(), "missing")).toEqual(keys());
    expect(revokeApiKey(undefined, "key_active")).toBeUndefined();
  });

  it("removes and restores a key at the captured index", () => {
    const removed = removeApiKey(keys(), "key_active");

    expect(removed.removedApiKey).toEqual(activeKey);
    expect(removed.removedIndex).toBe(0);
    expect(removed.data!.map((key) => key.keyId)).toEqual(["key_revoked"]);

    expect(
      restoreApiKey(removed.data, removed.removedApiKey, removed.removedIndex)
    ).toEqual(keys());
  });
});
