import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const backfillExistingNamespaceMock = vi.fn();

class MockNamespaceConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "NamespaceConflictError";
  }
}

vi.mock("@db/app", () => ({
  NamespaceConflictError: MockNamespaceConflictError,
  backfillExistingNamespace: backfillExistingNamespaceMock,
}));

const { backfillClerkNamespaces, hasNamespaceBackfillConflicts } = await import(
  "../services/namespaces/backfill"
);

const db = {} as Database;

function clerkClientMock() {
  return {
    organizations: {
      getOrganizationList: vi.fn(),
    },
    users: {
      getUserList: vi.fn(),
    },
  };
}

beforeEach(() => {
  backfillExistingNamespaceMock.mockReset();
  backfillExistingNamespaceMock.mockResolvedValue({ status: "backfilled" });
});

describe("backfillClerkNamespaces", () => {
  it("backfills Clerk usernames and organization slugs into Lightfast namespaces", async () => {
    const clerk = clerkClientMock();
    clerk.users.getUserList.mockResolvedValueOnce({
      data: [
        { id: "user_1", username: "Ada-Dev" },
        { id: "user_2", username: null },
      ],
      totalCount: 2,
    });
    clerk.organizations.getOrganizationList.mockResolvedValueOnce({
      data: [{ id: "org_1", slug: "Acme-Inc" }],
      totalCount: 1,
    });

    await expect(backfillClerkNamespaces({ clerk, db })).resolves.toEqual({
      orgs: {
        alreadyActive: 0,
        backfilled: 1,
        conflicts: 0,
        scanned: 1,
        skipped: 0,
      },
      users: {
        alreadyActive: 0,
        backfilled: 1,
        conflicts: 0,
        scanned: 2,
        skipped: 1,
      },
    });

    expect(backfillExistingNamespaceMock).toHaveBeenCalledWith(db, {
      clerkUserId: "user_1",
      handle: "ada-dev",
      kind: "user",
    });
    expect(backfillExistingNamespaceMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_1",
      handle: "acme-inc",
      kind: "org",
    });
  });

  it("records invalid handles and namespace conflicts without aborting the run", async () => {
    const clerk = clerkClientMock();
    clerk.users.getUserList.mockResolvedValueOnce({
      data: [{ id: "user_1", username: "docs" }],
      totalCount: 1,
    });
    clerk.organizations.getOrganizationList.mockResolvedValueOnce({
      data: [{ id: "org_1", slug: "acme-inc" }],
      totalCount: 1,
    });
    backfillExistingNamespaceMock.mockRejectedValueOnce(
      new MockNamespaceConflictError(
        "HANDLE_ALREADY_CLAIMED",
        "Handle acme-inc is already claimed"
      )
    );

    await expect(backfillClerkNamespaces({ clerk, db })).resolves.toEqual({
      orgs: {
        alreadyActive: 0,
        backfilled: 0,
        conflicts: 1,
        scanned: 1,
        skipped: 0,
      },
      users: {
        alreadyActive: 0,
        backfilled: 0,
        conflicts: 0,
        scanned: 1,
        skipped: 1,
      },
    });

    expect(backfillExistingNamespaceMock).toHaveBeenCalledTimes(1);
    expect(backfillExistingNamespaceMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_1",
      handle: "acme-inc",
      kind: "org",
    });
  });

  it("detects whether a backfill result has conflicts", () => {
    expect(
      hasNamespaceBackfillConflicts({
        orgs: {
          alreadyActive: 0,
          backfilled: 0,
          conflicts: 1,
          scanned: 1,
          skipped: 0,
        },
        users: {
          alreadyActive: 0,
          backfilled: 1,
          conflicts: 0,
          scanned: 1,
          skipped: 0,
        },
      })
    ).toBe(true);
    expect(
      hasNamespaceBackfillConflicts({
        orgs: {
          alreadyActive: 1,
          backfilled: 0,
          conflicts: 0,
          scanned: 1,
          skipped: 0,
        },
        users: {
          alreadyActive: 0,
          backfilled: 1,
          conflicts: 0,
          scanned: 1,
          skipped: 0,
        },
      })
    ).toBe(false);
  });
});
