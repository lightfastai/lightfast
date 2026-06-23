import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  type AccountCommandDeps,
  type AccountUsernameNamespaceOperation,
  createAccountUsernameCommand,
  getAccountProfileCommand,
  updateAccountNameCommand,
} from "../domain/account";

const getUserMock = vi.fn();
const updateUserMock = vi.fn();
const isClerkConflictErrorMock = vi.fn();
const startNamespaceOperationMock = vi.fn();
const reserveNamespaceForOperationMock = vi.fn();
const markNamespaceOperationClerkAppliedMock = vi.fn();
const finalizeNamespaceOperationMock = vi.fn();
const deletePreClerkNamespaceReservationMock = vi.fn();
const logErrorMock = vi.fn();
const isNamespaceConflictErrorMock = vi.fn();

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

function ctx(identity: AuthIdentity = pendingIdentity) {
  return {
    actor: actorFromAuthIdentity(identity, "web"),
    request: { id: "req_test", source: "tanstack" as const },
  };
}

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
  overrides: Partial<AccountUsernameNamespaceOperation> = {}
): AccountUsernameNamespaceOperation {
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

function deps() {
  return {
    disconnectGitHubUserAccount: vi.fn(),
    getGitHubUserAccountStatus: vi.fn(),
    log: { error: logErrorMock },
    parseError: (error: unknown) => error,
    startGitHubUserAccountBinding: vi.fn(),
    usernameNamespace: {
      deletePreClerkReservation: deletePreClerkNamespaceReservationMock,
      finalize: finalizeNamespaceOperationMock,
      isConflict: isNamespaceConflictErrorMock,
      markClerkApplied: markNamespaceOperationClerkAppliedMock,
      reserve: reserveNamespaceForOperationMock,
      start: startNamespaceOperationMock,
    },
    users: {
      getUser: getUserMock,
      isUsernameConflictError: isClerkConflictErrorMock,
      updateUser: updateUserMock,
    },
  } satisfies AccountCommandDeps;
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
  logErrorMock.mockReset();
  isNamespaceConflictErrorMock.mockReset();

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
  isNamespaceConflictErrorMock.mockImplementation(
    (error: unknown): error is { code: "HANDLE_ALREADY_CLAIMED" } =>
      error instanceof Error &&
      error.name === "NamespaceConflictError" &&
      "code" in error
  );
});

describe("account domain commands", () => {
  it("loads a pending Clerk user's account profile", async () => {
    await expect(
      getAccountProfileCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: {},
      })
    ).resolves.toEqual({
      createdAt: "2026-06-01T00:00:00.000Z",
      firstName: "Ada",
      fullName: "Ada Lovelace",
      id: "user_test",
      imageUrl: "https://img.example.com/user.png",
      initials: "AL",
      lastName: "Lovelace",
      primaryEmailAddress: "ada@example.com",
      username: null,
    });

    expect(getUserMock).toHaveBeenCalledWith("user_test");
  });

  it("updates the Clerk display name for the signed-in user", async () => {
    await expect(
      updateAccountNameCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { displayName: "Ada Lovelace" },
      })
    ).resolves.toMatchObject({
      firstName: "Ada Lovelace",
      fullName: "Ada Lovelace",
      lastName: "",
    });

    expect(updateUserMock).toHaveBeenCalledWith("user_test", {
      firstName: "Ada Lovelace",
      lastName: "",
    });
  });

  it("reserves the Lightfast namespace before setting Clerk username", async () => {
    await expect(
      createAccountUsernameCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { idempotencyKey: "idem_1", username: "Ada-Dev" },
      })
    ).resolves.toMatchObject({
      id: "user_test",
      username: "ada-dev",
    });

    expect(startNamespaceOperationMock).toHaveBeenCalledWith({
      clerkUserId: "user_test",
      idempotencyKey: "idem_1",
      operationType: "create_user_username",
      ownerKind: "user",
      toHandle: "ada-dev",
    });
    expect(updateUserMock).toHaveBeenCalledWith("user_test", {
      username: "ada-dev",
    });
    expect(finalizeNamespaceOperationMock).toHaveBeenCalledWith(
      operation({ status: "clerk_applied" })
    );
  });

  it("returns the existing profile when retrying the same username", async () => {
    getUserMock.mockResolvedValue(clerkUser({ username: "ada-dev" }));

    await expect(
      createAccountUsernameCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { idempotencyKey: "idem_1", username: "ada-dev" },
      })
    ).resolves.toMatchObject({ username: "ada-dev" });

    expect(startNamespaceOperationMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects attempts to change an existing username with a domain validation error", async () => {
    getUserMock.mockResolvedValue(clerkUser({ username: "ada-dev" }));

    await expect(
      createAccountUsernameCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { idempotencyKey: "idem_1", username: "other-dev" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "USERNAME_ALREADY_SET",
        kind: "validation",
        message: "Username has already been set",
      })
    );

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
      createAccountUsernameCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { idempotencyKey: "idem_1", username: "ada-dev" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "USERNAME_CONFLICT",
        kind: "conflict",
        message: "This username is already taken",
      })
    );

    expect(deletePreClerkNamespaceReservationMock).toHaveBeenCalledWith(
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
