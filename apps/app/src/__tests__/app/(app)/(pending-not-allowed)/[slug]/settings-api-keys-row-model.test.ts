import { describe, expect, it } from "vitest";

import { getOrgApiKeyRowModel } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-row-model";

describe("org API key row model", () => {
  it("derives display and pending state without rendering the row", () => {
    expect(
      getOrgApiKeyRowModel(
        {
          createdAt: 1_700_000_000_000,
          enabled: true,
          expires: 1_700_000_010_000,
          keyId: "key_active",
          name: undefined,
          start: "lf_active",
          updatedAt: 1_700_000_000_000,
        },
        {
          now: 1_700_000_000_001,
          pendingRevokeKeyId: "key_active",
        }
      )
    ).toEqual({
      isActive: true,
      isExpired: false,
      isPending: true,
      keyName: "lf_active",
    });
  });

  it("marks enabled keys inactive after expiration", () => {
    expect(
      getOrgApiKeyRowModel(
        {
          createdAt: 1_700_000_000_000,
          enabled: true,
          expires: 1_700_000_000_000,
          keyId: "key_expired",
          name: "Expired",
          start: "lf_expired",
          updatedAt: 1_700_000_000_000,
        },
        { now: 1_700_000_000_001 }
      )
    ).toMatchObject({
      isActive: false,
      isExpired: true,
      isPending: false,
      keyName: "Expired",
    });
  });
});
