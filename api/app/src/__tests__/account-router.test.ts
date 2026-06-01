import type { Database } from "@db/app";
import type { NamespaceOperation } from "@db/app/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const getUserMock = vi.fn();
const updateUserMock = vi.fn();
const isClerkConflictErrorMock = vi.fn();
const startNamespaceOperationMock = vi.fn();
const reserveNamespaceForOperationMock = vi.fn();
const markNamespaceOperationClerkAppliedMock = vi.fn();
const finalizeNamespaceOperationMock = vi.fn();
const deletePreClerkNamespaceReservationMock = vi.fn();
const failUnreservedNamespaceOperationMock = vi.fn();

class MockNamespaceConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "NamespaceConflictError";
  }
}

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  NamespaceConflictError: MockNamespaceConflictError,
  deletePreClerkNamespaceReservation: deletePreClerkNamespaceReservationMock,
  failUnreservedNamespaceOperation: failUnreservedNamespaceOperationMock,
  finalizeNamespaceOperation: finalizeNamespaceOperationMock,
  markNamespaceOperationClerkApplied: markNamespaceOperationClerkAppliedMock,
  reserveNamespaceForOperation: reserveNamespaceForOperationMock,
  startNamespaceOperation: startNamespaceOperationMock,
}));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      users: {
        getUser: getUserMock,
        updateUser: updateUserMock,
      },
    }),
}));

vi.mock("../auth/clerk-errors", () => ({
  isClerkConflictError: isClerkConflictErrorMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { accountRouter } = await import("../router/(pending-allowed)/account");

const testRouter = createTRPCRouter({
  viewer: createTRPCRouter({
    account: accountRouter,
  }),
});
const createCaller = createCallerFactory(testRouter);

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function clerkUser(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: Date.parse("2026-06-01T00:00:00.000Z"),
    firstName: "Ada",
    id: "user_test",
    imageUrl: "https://img.example.com/user.png",
    lastName: "Lovelace",
    primaryEmailAddress: { emailAddress: "ada@example.com" },
    username: null,
    ...overrides,
  };
}

function operation(
  overrides: Partial<NamespaceOperation> = {}
): NamespaceOperation {
  return {
    id: 1,
    clerkOrgId: null,
    clerkUserId: "user_test",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    errorCode: null,
    errorMessage: null,
    expiresAt: new Date("2026-06-01T00:15:00.000Z"),
    fromHandle: null,
    idempotencyClerkOrgId: null,
    idempotencyClerkUserId: "user_test",
    idempotencyKey: "idem_1",
    operationType: "create_user_username",
    ownerKind: "user",
    status: "started",
    toHandle: "ada-dev",
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function caller(identity = pendingIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  updateUserMock.mockReset();
  isClerkConflictErrorMock.mockReset();
  startNamespaceOperationMock.mockReset();
  reserveNamespaceForOperationMock.mockReset();
  markNamespaceOperationClerkAppliedMock.mockReset();
  finalizeNamespaceOperationMock.mockReset();
  deletePreClerkNamespaceReservationMock.mockReset();
  failUnreservedNamespaceOperationMock.mockReset();

  getUserMock.mockResolvedValue(clerkUser());
  updateUserMock.mockImplementation(
    (_userId: string, params: Record<string, unknown>) =>
      Promise.resolve(clerkUser(params))
  );
  isClerkConflictErrorMock.mockReturnValue(false);
  startNamespaceOperationMock.mockResolvedValue(operation());
  reserveNamespaceForOperationMock.mockResolvedValue(
    operation({ status: "namespace_reserved" })
  );
  markNamespaceOperationClerkAppliedMock.mockResolvedValue(
    operation({ status: "clerk_applied" })
  );
  finalizeNamespaceOperationMock.mockResolvedValue(
    operation({ status: "finalized" })
  );
});

describe("account.updateName", () => {
  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).viewer.account.updateName({
        name: "Ada Lovelace",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("updates the Clerk first and last name from a display name", async () => {
    await expect(
      caller().viewer.account.updateName({ name: "Ada Lovelace" })
    ).resolves.toMatchObject({
      firstName: "Ada",
      fullName: "Ada Lovelace",
      lastName: "Lovelace",
    });

    expect(updateUserMock).toHaveBeenCalledWith("user_test", {
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });
});

describe("account.createUsername", () => {
  it("reserves the Lightfast namespace before setting Clerk username", async () => {
    await expect(
      caller().viewer.account.createUsername({
        idempotencyKey: "idem_1",
        username: "Ada-Dev",
      })
    ).resolves.toMatchObject({
      id: "user_test",
      username: "ada-dev",
    });

    expect(startNamespaceOperationMock).toHaveBeenCalledWith(expect.anything(), {
      clerkUserId: "user_test",
      idempotencyKey: "idem_1",
      operationType: "create_user_username",
      ownerKind: "user",
      toHandle: "ada-dev",
    });
    expect(reserveNamespaceForOperationMock).toHaveBeenCalledWith(
      expect.anything(),
      operation()
    );
    expect(updateUserMock).toHaveBeenCalledWith("user_test", {
      username: "ada-dev",
    });
    expect(markNamespaceOperationClerkAppliedMock).toHaveBeenCalledWith(
      expect.anything(),
      operation({ status: "namespace_reserved" })
    );
    expect(finalizeNamespaceOperationMock).toHaveBeenCalledWith(
      expect.anything(),
      operation({ status: "clerk_applied" })
    );
  });

  it("does not allow changing an existing username", async () => {
    getUserMock.mockResolvedValue(clerkUser({ username: "ada-dev" }));

    await expect(
      caller().viewer.account.createUsername({
        idempotencyKey: "idem_1",
        username: "other-dev",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Username has already been set",
    });

    expect(startNamespaceOperationMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("returns the existing profile when retrying the same username", async () => {
    getUserMock.mockResolvedValue(clerkUser({ username: "ada-dev" }));

    await expect(
      caller().viewer.account.createUsername({
        idempotencyKey: "idem_1",
        username: "ada-dev",
      })
    ).resolves.toMatchObject({
      username: "ada-dev",
    });

    expect(startNamespaceOperationMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("deletes the pre-Clerk reservation when Clerk rejects the username", async () => {
    const clerkError = new Error("username already exists");
    updateUserMock.mockRejectedValue(clerkError);
    isClerkConflictErrorMock.mockReturnValue(true);
    deletePreClerkNamespaceReservationMock.mockResolvedValue(
      operation({ status: "failed" })
    );

    await expect(
      caller().viewer.account.createUsername({
        idempotencyKey: "idem_1",
        username: "ada-dev",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This username is already taken",
    });

    expect(deletePreClerkNamespaceReservationMock).toHaveBeenCalledWith(
      expect.anything(),
      operation({ status: "namespace_reserved" }),
      {
        errorCode: "CLERK_USERNAME_CONFLICT",
        errorMessage: "Clerk rejected username ada-dev as already claimed",
      }
    );
    expect(markNamespaceOperationClerkAppliedMock).not.toHaveBeenCalled();
    expect(finalizeNamespaceOperationMock).not.toHaveBeenCalled();
  });
});
