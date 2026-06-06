import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import type { NamespaceOperation } from "../schema";
import {
  deletePreClerkNamespaceReservation,
  failUnreservedNamespaceOperation,
  finalizeNamespaceOperation,
  getActiveNamespaceByHandle,
  listActiveOrgNamespaceClerkOrgIds,
  markNamespaceOperationClerkApplied,
  type NamespaceConflictError,
  NamespaceOperationConcurrencyError,
  reserveNamespaceForOperation,
  startNamespaceOperation,
  transitionNamespaceOperation,
} from "../utils/namespaces";

function operation(
  overrides: Partial<NamespaceOperation> = {}
): NamespaceOperation {
  return {
    clerkOrgId: null,
    clerkUserId: "user_123",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    errorCode: null,
    errorMessage: null,
    expiresAt: new Date("2026-06-01T00:15:00.000Z"),
    fromHandle: null,
    id: 1,
    idempotencyClerkOrgId: null,
    idempotencyClerkUserId: "user_123",
    idempotencyKey: "idem_1",
    operationType: "create_user_username",
    ownerKind: "user",
    status: "started",
    toHandle: "acme-user",
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function duplicateKeyError() {
  return Object.assign(new Error("Duplicate entry for key"), {
    code: "ER_DUP_ENTRY",
  });
}

describe("namespace repository", () => {
  it("resolves only active namespaces by normalized handle", async () => {
    const namespace = {
      activeOperationId: null,
      claimedClerkOrgId: null,
      claimedClerkUserId: "user_123",
      clerkOrgId: null,
      clerkUserId: "user_123",
      createdAt: new Date(),
      handle: "acme-user",
      id: 10,
      kind: "user",
      status: "active",
      updatedAt: new Date(),
    };
    const limit = vi.fn(() => Promise.resolve([namespace]));
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const db = { select } as unknown as Database;

    await expect(getActiveNamespaceByHandle(db, " Acme-User ")).resolves.toBe(
      namespace
    );

    expect(limit).toHaveBeenCalledWith(1);
  });

  it("starts a namespace operation and returns the inserted row", async () => {
    const inserted = operation();
    const returningId = vi.fn(() => Promise.resolve([{ id: 1 }]));
    const values = vi.fn(() => ({ $returningId: returningId }));
    const insert = vi.fn(() => ({ values }));
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([inserted]),
        }),
      }),
    }));
    const db = { insert, select } as unknown as Database;

    await expect(
      startNamespaceOperation(db, {
        clerkUserId: "user_123",
        idempotencyKey: "idem_1",
        operationType: "create_user_username",
        ownerKind: "user",
        toHandle: "Acme-User",
      })
    ).resolves.toBe(inserted);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "user_123",
        idempotencyClerkOrgId: null,
        idempotencyClerkUserId: "user_123",
        idempotencyKey: "idem_1",
        operationType: "create_user_username",
        ownerKind: "user",
        status: "started",
        toHandle: "acme-user",
      })
    );
  });

  it("starts a pre-Clerk org namespace operation scoped to the creating user", async () => {
    const inserted = operation({
      clerkOrgId: null,
      clerkUserId: "user_123",
      idempotencyClerkOrgId: null,
      idempotencyClerkUserId: "user_123",
      operationType: "create_org_slug",
      ownerKind: "org",
      toHandle: "acme-inc",
    });
    const returningId = vi.fn(() => Promise.resolve([{ id: 1 }]));
    const values = vi.fn(() => ({ $returningId: returningId }));
    const insert = vi.fn(() => ({ values }));
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([inserted]),
        }),
      }),
    }));
    const db = { insert, select } as unknown as Database;

    await expect(
      startNamespaceOperation(db, {
        clerkUserId: "user_123",
        idempotencyKey: "idem_org_1",
        operationType: "create_org_slug",
        ownerKind: "org",
        toHandle: "Acme-Inc",
      })
    ).resolves.toBe(inserted);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: null,
        clerkUserId: "user_123",
        idempotencyClerkOrgId: null,
        idempotencyClerkUserId: "user_123",
        idempotencyKey: "idem_org_1",
        operationType: "create_org_slug",
        ownerKind: "org",
        status: "started",
        toHandle: "acme-inc",
      })
    );
  });

  it("returns the existing operation for a repeated idempotency key", async () => {
    const existing = operation();
    const values = vi.fn(() => ({
      $returningId: () => Promise.reject(duplicateKeyError()),
    }));
    const insert = vi.fn(() => ({ values }));
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([existing]),
        }),
      }),
    }));
    const db = { insert, select } as unknown as Database;

    await expect(
      startNamespaceOperation(db, {
        clerkUserId: "user_123",
        idempotencyKey: "idem_1",
        operationType: "create_user_username",
        ownerKind: "user",
        toHandle: "acme-user",
      })
    ).resolves.toBe(existing);
  });

  it("returns an existing failed operation for a repeated idempotency key", async () => {
    const existing = operation({
      errorCode: "HANDLE_ALREADY_CLAIMED",
      errorMessage: "Handle acme-user is already claimed",
      status: "failed",
    });
    const values = vi.fn(() => ({
      $returningId: () => Promise.reject(duplicateKeyError()),
    }));
    const insert = vi.fn(() => ({ values }));
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([existing]),
        }),
      }),
    }));
    const db = { insert, select } as unknown as Database;

    await expect(
      startNamespaceOperation(db, {
        clerkUserId: "user_123",
        idempotencyKey: "idem_1",
        operationType: "create_user_username",
        ownerKind: "user",
        toHandle: "acme-user",
      })
    ).resolves.toBe(existing);
  });

  it("rejects an idempotency key reused with different input", async () => {
    const existing = operation({ toHandle: "other-user" });
    const values = vi.fn(() => ({
      $returningId: () => Promise.reject(duplicateKeyError()),
    }));
    const insert = vi.fn(() => ({ values }));
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([existing]),
        }),
      }),
    }));
    const db = { insert, select } as unknown as Database;

    await expect(
      startNamespaceOperation(db, {
        clerkUserId: "user_123",
        idempotencyKey: "idem_1",
        operationType: "create_user_username",
        ownerKind: "user",
        toHandle: "acme-user",
      })
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
      name: "NamespaceConflictError",
    } satisfies Partial<NamespaceConflictError>);
  });

  it("reserves a namespace and advances the operation", async () => {
    const activeOperation = operation({
      id: 7,
      status: "namespace_reserved",
    });
    const returningId = vi.fn(() => Promise.resolve([{ id: 20 }]));
    const values = vi.fn(() => ({ $returningId: returningId }));
    const insert = vi.fn(() => ({ values }));
    const operationUpdateWhere = vi.fn(() => ({ affectedRows: 1 }));
    const operationSet = vi.fn(() => ({ where: operationUpdateWhere }));
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([activeOperation]),
        }),
      }),
    }));
    const update = vi.fn(() => ({ set: operationSet }));
    const tx = { insert, select, update };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      reserveNamespaceForOperation(db, operation({ id: 7 }))
    ).resolves.toBe(activeOperation);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOperationId: 7,
        clerkUserId: "user_123",
        handle: "acme-user",
        kind: "user",
        status: "reserved",
      })
    );
    expect(operationSet).toHaveBeenCalledWith({ status: "namespace_reserved" });
  });

  it("returns an already reserved operation without touching the database", async () => {
    const existingOperation = operation({
      id: 7,
      status: "namespace_reserved",
    });
    const db = {
      transaction: vi.fn(),
    } as unknown as Database;

    await expect(
      reserveNamespaceForOperation(db, existingOperation)
    ).resolves.toBe(existingOperation);

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("throws on stale transition compare-and-set misses", async () => {
    const where = vi.fn(() => ({ affectedRows: 0 }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const db = { update } as unknown as Database;

    await expect(
      transitionNamespaceOperation(db, operation(), {
        type: "RESERVE_NAMESPACE",
      })
    ).rejects.toBeInstanceOf(NamespaceOperationConcurrencyError);
  });

  it("returns a handle conflict when another owner already reserved the handle", async () => {
    const failed = operation({
      errorCode: "HANDLE_ALREADY_CLAIMED",
      errorMessage: "Handle acme-user is already claimed",
      status: "failed",
    });
    const values = vi.fn(() => ({
      $returningId: () => Promise.reject(duplicateKeyError()),
    }));
    const insert = vi.fn(() => ({ values }));
    const conflictNamespace = {
      activeOperationId: 9,
      claimedClerkOrgId: "org_123",
      claimedClerkUserId: null,
      clerkOrgId: "org_123",
      clerkUserId: null,
      createdAt: new Date(),
      handle: "acme-user",
      id: 30,
      kind: "org",
      status: "reserved",
      updatedAt: new Date(),
    };
    const selectResults = [[conflictNamespace], [failed]];
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectResults.shift() ?? []),
        }),
      }),
    }));
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const tx = { insert, select, update };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      reserveNamespaceForOperation(db, operation())
    ).rejects.toMatchObject({
      code: "HANDLE_ALREADY_CLAIMED",
      name: "NamespaceConflictError",
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "HANDLE_ALREADY_CLAIMED",
        status: "failed",
      })
    );
  });

  it("returns an owner-in-progress conflict when the same owner already reserved the handle through another operation", async () => {
    const failed = operation({
      errorCode: "OWNER_NAMESPACE_IN_PROGRESS",
      errorMessage: "Owner already has a namespace operation in progress",
      status: "failed",
    });
    const values = vi.fn(() => ({
      $returningId: () => Promise.reject(duplicateKeyError()),
    }));
    const insert = vi.fn(() => ({ values }));
    const conflictNamespace = {
      activeOperationId: 99,
      claimedClerkOrgId: null,
      claimedClerkUserId: "user_123",
      clerkOrgId: null,
      clerkUserId: "user_123",
      createdAt: new Date(),
      handle: "acme-user",
      id: 31,
      kind: "user",
      status: "reserved",
      updatedAt: new Date(),
    };
    const selectResults = [[conflictNamespace], [failed]];
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectResults.shift() ?? []),
        }),
      }),
    }));
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const tx = { insert, select, update };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      reserveNamespaceForOperation(db, operation({ id: 7 }))
    ).rejects.toMatchObject({
      code: "OWNER_NAMESPACE_IN_PROGRESS",
      name: "NamespaceConflictError",
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "OWNER_NAMESPACE_IN_PROGRESS",
        status: "failed",
      })
    );
  });

  it("returns an owner conflict when the same owner already has an active handle", async () => {
    const failed = operation({
      errorCode: "OWNER_ALREADY_CLAIMED",
      errorMessage: "Owner already has a claimed namespace handle",
      status: "failed",
    });
    const values = vi.fn(() => ({
      $returningId: () => Promise.reject(duplicateKeyError()),
    }));
    const insert = vi.fn(() => ({ values }));
    const selectResults = [
      [],
      [
        {
          activeOperationId: null,
          claimedClerkOrgId: null,
          claimedClerkUserId: "user_123",
          clerkOrgId: null,
          clerkUserId: "user_123",
          createdAt: new Date(),
          handle: "other-user",
          id: 32,
          kind: "user",
          status: "active",
          updatedAt: new Date(),
        },
      ],
      [failed],
    ];
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectResults.shift() ?? []),
        }),
      }),
    }));
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const tx = { insert, select, update };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      reserveNamespaceForOperation(db, operation())
    ).rejects.toMatchObject({
      code: "OWNER_ALREADY_CLAIMED",
      name: "NamespaceConflictError",
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "OWNER_ALREADY_CLAIMED",
        status: "failed",
      })
    );
  });

  it("marks Clerk applied and finalizes a reserved namespace", async () => {
    const clerkApplied = operation({ status: "clerk_applied" });
    const finalized = operation({ status: "finalized" });
    const setCalls: unknown[] = [];
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn((value: unknown) => {
      setCalls.push(value);
      return { where };
    });
    const namespaceWhere = vi.fn(() => ({ affectedRows: 1 }));
    const namespaceSet = vi.fn(() => ({ where: namespaceWhere }));
    const selectResults = [[clerkApplied], [finalized]];
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectResults.shift() ?? []),
        }),
      }),
    }));
    const update = vi
      .fn()
      .mockReturnValueOnce({ set })
      .mockReturnValueOnce({ set: namespaceSet })
      .mockReturnValueOnce({ set });
    const tx = { select, update };
    const db = {
      select,
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
      update,
    } as unknown as Database;

    const afterClerk = await markNamespaceOperationClerkApplied(
      db,
      operation({ status: "namespace_reserved" })
    );
    await expect(finalizeNamespaceOperation(db, afterClerk)).resolves.toBe(
      finalized
    );

    expect(namespaceSet).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOperationId: null,
        status: "active",
      })
    );
    expect(setCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "clerk_applied" }),
        expect.objectContaining({ status: "finalized" }),
      ])
    );
  });

  it("stores the Clerk org id before finalizing a pre-Clerk org namespace", async () => {
    const clerkApplied = operation({
      clerkOrgId: "org_123",
      clerkUserId: "user_123",
      operationType: "create_org_slug",
      ownerKind: "org",
      status: "clerk_applied",
      toHandle: "acme-inc",
    });
    const finalized = operation({
      ...clerkApplied,
      status: "finalized",
    });
    const setCalls: unknown[] = [];
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn((value: unknown) => {
      setCalls.push(value);
      return { where };
    });
    const namespaceWhere = vi.fn(() => ({ affectedRows: 1 }));
    const namespaceSet = vi.fn((value: unknown) => {
      setCalls.push(value);
      return { where: namespaceWhere };
    });
    const selectResults = [[clerkApplied], [finalized]];
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectResults.shift() ?? []),
        }),
      }),
    }));
    const update = vi
      .fn()
      .mockReturnValueOnce({ set })
      .mockReturnValueOnce({ set: namespaceSet })
      .mockReturnValueOnce({ set });
    const tx = { select, update };
    const db = {
      select,
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
      update,
    } as unknown as Database;

    const afterClerk = await markNamespaceOperationClerkApplied(
      db,
      operation({
        clerkOrgId: null,
        operationType: "create_org_slug",
        ownerKind: "org",
        status: "namespace_reserved",
        toHandle: "acme-inc",
      }),
      { clerkOrgId: "org_123" }
    );
    await expect(finalizeNamespaceOperation(db, afterClerk)).resolves.toBe(
      finalized
    );

    expect(setCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clerkOrgId: "org_123",
          status: "clerk_applied",
        }),
        expect.objectContaining({
          activeOperationId: null,
          claimedClerkOrgId: "org_123",
          clerkOrgId: "org_123",
          status: "active",
        }),
        expect.objectContaining({ status: "finalized" }),
      ])
    );
  });

  it("fails a started operation with a stored error", async () => {
    const failed = operation({
      errorCode: "CLERK_REJECTED",
      errorMessage: "Clerk rejected the handle",
      status: "failed",
    });
    const where = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([failed]),
        }),
      }),
    }));
    const db = { select, update } as unknown as Database;

    await expect(
      failUnreservedNamespaceOperation(db, operation({ status: "started" }), {
        errorCode: "CLERK_REJECTED",
        errorMessage: "Clerk rejected the handle",
      })
    ).resolves.toBe(failed);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "CLERK_REJECTED",
        errorMessage: "Clerk rejected the handle",
        status: "failed",
      })
    );
  });

  it("deletes a safe pre-Clerk reservation and fails the operation", async () => {
    const failed = operation({
      errorCode: "RESERVATION_EXPIRED",
      errorMessage: "Reservation expired before Clerk was called",
      status: "failed",
    });
    const deleteWhere = vi.fn(() => ({ affectedRows: 1 }));
    const deleteFrom = vi.fn(() => ({ where: deleteWhere }));
    const updateWhere = vi.fn(() => ({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set }));
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([failed]),
        }),
      }),
    }));
    const tx = { delete: deleteFrom, select, update };
    const db = {
      delete: deleteFrom,
      select,
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
      update,
    } as unknown as Database;

    await expect(
      deletePreClerkNamespaceReservation(
        db,
        operation({ id: 7, status: "namespace_reserved" }),
        {
          errorCode: "RESERVATION_EXPIRED",
          errorMessage: "Reservation expired before Clerk was called",
        }
      )
    ).resolves.toBe(failed);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "RESERVATION_EXPIRED",
        errorMessage: "Reservation expired before Clerk was called",
        status: "failed",
      })
    );
    expect(deleteFrom).toHaveBeenCalledOnce();
  });
});

describe("listActiveOrgNamespaceClerkOrgIds", () => {
  it("returns active org namespace clerk ids with cursor pagination", async () => {
    const rows = [
      { id: 1, clerkOrgId: "org_one" },
      { id: 2, clerkOrgId: "org_two" },
    ];
    const spies = {
      limit: vi.fn(() => Promise.resolve(rows)),
      orderBy: vi.fn(),
      where: vi.fn(),
    };
    const db = {
      select: () => ({
        from: () => ({
          where: (condition: unknown) => {
            spies.where(condition);
            return {
              orderBy: (...order: unknown[]) => {
                spies.orderBy(...order);
                return { limit: spies.limit };
              },
            };
          },
        }),
      }),
    } as unknown as Database;

    await expect(
      listActiveOrgNamespaceClerkOrgIds(db, { limit: 1 })
    ).resolves.toEqual({
      items: [{ id: 1, clerkOrgId: "org_one" }],
      nextCursor: 1,
    });

    expect(spies.limit).toHaveBeenCalledWith(2);
    expect(spies.where).toHaveBeenCalledOnce();
  });

  it("defaults non-finite limits to the first page size", async () => {
    const spies = {
      limit: vi.fn(() => Promise.resolve([])),
      orderBy: vi.fn(),
      where: vi.fn(),
    };
    const db = {
      select: () => ({
        from: () => ({
          where: (condition: unknown) => {
            spies.where(condition);
            return {
              orderBy: (...order: unknown[]) => {
                spies.orderBy(...order);
                return { limit: spies.limit };
              },
            };
          },
        }),
      }),
    } as unknown as Database;

    await expect(
      listActiveOrgNamespaceClerkOrgIds(db, { limit: Number.NaN })
    ).resolves.toEqual({
      items: [],
      nextCursor: null,
    });

    expect(spies.limit).toHaveBeenCalledWith(51);
  });
});
