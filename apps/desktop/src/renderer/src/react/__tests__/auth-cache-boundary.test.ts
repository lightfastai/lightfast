import { describe, expect, it } from "vitest";
import type { AuthSnapshot } from "../../../../shared/ipc";
import { hasAuthCacheBoundaryChanged } from "../auth-cache-boundary";

const signedOut: AuthSnapshot = { isSignedIn: false };

const signedIn: AuthSnapshot = {
  isSignedIn: true,
  organizationId: "org_1",
  organizationName: "Acme",
  organizationSlug: "acme",
  userEmail: "dev@example.com",
};

describe("hasAuthCacheBoundaryChanged", () => {
  it("changes when the signed-in state changes", () => {
    expect(hasAuthCacheBoundaryChanged(signedOut, signedIn)).toBe(true);
    expect(hasAuthCacheBoundaryChanged(signedIn, signedOut)).toBe(true);
  });

  it("changes when the signed-in account or organization changes", () => {
    expect(
      hasAuthCacheBoundaryChanged(signedIn, {
        ...signedIn,
        userEmail: "other@example.com",
      })
    ).toBe(true);
    expect(
      hasAuthCacheBoundaryChanged(signedIn, {
        ...signedIn,
        organizationId: "org_2",
      })
    ).toBe(true);
  });

  it("does not change for equivalent auth snapshots", () => {
    expect(hasAuthCacheBoundaryChanged(signedIn, { ...signedIn })).toBe(false);
  });
});
