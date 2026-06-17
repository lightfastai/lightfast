import type { Database } from "@db/app";
import {
  deletePreClerkNamespaceReservation,
  finalizeNamespaceOperation,
  markNamespaceOperationClerkApplied,
  NamespaceConflictError,
  reserveNamespaceForOperation,
  startNamespaceOperation,
} from "@db/app";
import {
  accountSettingsFormSchema,
  lightfastHandleSchema,
} from "@repo/app-validation";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import { isClerkConflictError } from "../../auth/clerk-errors";
import { defineCommand } from "../command";
import {
  AuthzError,
  ConflictError,
  InternalDomainError,
  ValidationError,
} from "../errors";
import { requireClerkUserActor } from "../gates";
import { type AccountProfileUser, toAccountProfile } from "./profile";

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;
type ClerkUserClient = Pick<ClerkClient["users"], "getUser" | "updateUser">;

interface AccountCommandDeps {
  clerk: { users: ClerkUserClient };
  db: Database;
  deletePreClerkNamespaceReservation: typeof deletePreClerkNamespaceReservation;
  finalizeNamespaceOperation: typeof finalizeNamespaceOperation;
  isClerkConflictError: typeof isClerkConflictError;
  log: Pick<typeof log, "error">;
  markNamespaceOperationClerkApplied: typeof markNamespaceOperationClerkApplied;
  reserveNamespaceForOperation: typeof reserveNamespaceForOperation;
  startNamespaceOperation: typeof startNamespaceOperation;
}

export function createDefaultAccountCommandDeps(input: {
  clerk: { users: ClerkUserClient };
  db: Database;
  deletePreClerkNamespaceReservation?: typeof deletePreClerkNamespaceReservation;
  finalizeNamespaceOperation?: typeof finalizeNamespaceOperation;
  isClerkConflictError?: typeof isClerkConflictError;
  log?: Pick<typeof log, "error">;
  markNamespaceOperationClerkApplied?: typeof markNamespaceOperationClerkApplied;
  reserveNamespaceForOperation?: typeof reserveNamespaceForOperation;
  startNamespaceOperation?: typeof startNamespaceOperation;
}): AccountCommandDeps;
export function createDefaultAccountCommandDeps(input: {
  clerk?: { users: ClerkUserClient };
  db: Database;
  deletePreClerkNamespaceReservation?: typeof deletePreClerkNamespaceReservation;
  finalizeNamespaceOperation?: typeof finalizeNamespaceOperation;
  isClerkConflictError?: typeof isClerkConflictError;
  log?: Pick<typeof log, "error">;
  markNamespaceOperationClerkApplied?: typeof markNamespaceOperationClerkApplied;
  reserveNamespaceForOperation?: typeof reserveNamespaceForOperation;
  startNamespaceOperation?: typeof startNamespaceOperation;
}): Promise<AccountCommandDeps>;
export function createDefaultAccountCommandDeps(input: {
  clerk?: { users: ClerkUserClient };
  db: Database;
  deletePreClerkNamespaceReservation?: typeof deletePreClerkNamespaceReservation;
  finalizeNamespaceOperation?: typeof finalizeNamespaceOperation;
  isClerkConflictError?: typeof isClerkConflictError;
  log?: Pick<typeof log, "error">;
  markNamespaceOperationClerkApplied?: typeof markNamespaceOperationClerkApplied;
  reserveNamespaceForOperation?: typeof reserveNamespaceForOperation;
  startNamespaceOperation?: typeof startNamespaceOperation;
}): AccountCommandDeps | Promise<AccountCommandDeps> {
  const base = {
    db: input.db,
    deletePreClerkNamespaceReservation:
      input.deletePreClerkNamespaceReservation ??
      deletePreClerkNamespaceReservation,
    finalizeNamespaceOperation:
      input.finalizeNamespaceOperation ?? finalizeNamespaceOperation,
    isClerkConflictError: input.isClerkConflictError ?? isClerkConflictError,
    log: input.log ?? log,
    markNamespaceOperationClerkApplied:
      input.markNamespaceOperationClerkApplied ??
      markNamespaceOperationClerkApplied,
    reserveNamespaceForOperation:
      input.reserveNamespaceForOperation ?? reserveNamespaceForOperation,
    startNamespaceOperation:
      input.startNamespaceOperation ?? startNamespaceOperation,
  };

  if (input.clerk) {
    return { ...base, clerk: input.clerk };
  }

  return Promise.resolve(clerkClient()).then((clerk) => ({ ...base, clerk }));
}

const accountProfileInput = z.object({}).strict();
const accountProfileOutput = z.object({
  createdAt: z.string(),
  firstName: z.string().nullable(),
  fullName: z.string().nullable(),
  id: z.string().min(1),
  imageUrl: z.string(),
  initials: z.string().min(1),
  lastName: z.string().nullable(),
  primaryEmailAddress: z.string().nullable(),
  username: z.string().nullable(),
});

const createAccountUsernameInput = z.object({
  idempotencyKey: z.string().min(1).max(128),
  username: lightfastHandleSchema,
});

function usernameConflict(username: string, cause?: unknown) {
  return new ConflictError(
    "USERNAME_CONFLICT",
    "This username is already taken",
    { username },
    cause instanceof Error ? { cause } : undefined
  );
}

function namespaceConflictToDomainError(
  error: NamespaceConflictError,
  username: string
) {
  switch (error.code) {
    case "HANDLE_ALREADY_CLAIMED":
      return usernameConflict(username, error);
    case "OWNER_ALREADY_CLAIMED":
      return new ValidationError(
        "USERNAME_ALREADY_SET",
        "Username has already been set",
        { username },
        { cause: error }
      );
    case "OWNER_NAMESPACE_IN_PROGRESS":
      return new ConflictError(
        "USERNAME_SETUP_IN_PROGRESS",
        "Username setup is already in progress",
        { username },
        { cause: error }
      );
    case "IDEMPOTENCY_KEY_REUSED":
      return new ConflictError(
        "USERNAME_IDEMPOTENCY_KEY_REUSED",
        "This username request was already used with different input",
        { username },
        { cause: error }
      );
    case "OWNER_MISMATCH":
      return new AuthzError(
        "USERNAME_OWNER_MISMATCH",
        "Username operation owner mismatch",
        { username },
        { cause: error }
      );
    default:
      return new InternalDomainError(
        "USERNAME_NAMESPACE_UNKNOWN_CONFLICT",
        "Unknown username namespace conflict",
        { username, code: error.code },
        { cause: error }
      );
  }
}

export const getAccountProfileCommand = defineCommand<
  "account.getProfile",
  typeof accountProfileInput,
  typeof accountProfileOutput,
  AccountCommandDeps
>({
  name: "account.getProfile",
  input: accountProfileInput,
  output: accountProfileOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireClerkUserActor(ctx);

    try {
      const user = await deps.clerk.users.getUser(actor.userId);
      return toAccountProfile(user);
    } catch (error) {
      deps.log.error("[account] get profile failed", {
        userId: actor.userId,
        error: parseError(error),
      });

      throw new InternalDomainError(
        "ACCOUNT_PROFILE_GET_FAILED",
        "Failed to fetch user profile",
        {},
        error instanceof Error ? { cause: error } : undefined
      );
    }
  },
});

export const updateAccountNameCommand = defineCommand<
  "account.updateName",
  typeof accountSettingsFormSchema,
  typeof accountProfileOutput,
  AccountCommandDeps
>({
  name: "account.updateName",
  input: accountSettingsFormSchema,
  output: accountProfileOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkUserActor(ctx);

    try {
      const user = await deps.clerk.users.updateUser(actor.userId, {
        firstName: input.displayName,
        lastName: "",
      });

      return toAccountProfile(user);
    } catch (error) {
      deps.log.error("[account] update display name failed", {
        userId: actor.userId,
        error: parseError(error),
      });

      throw new InternalDomainError(
        "ACCOUNT_NAME_UPDATE_FAILED",
        "Failed to update display name",
        {},
        error instanceof Error ? { cause: error } : undefined
      );
    }
  },
});

export const createAccountUsernameCommand = defineCommand<
  "account.createUsername",
  typeof createAccountUsernameInput,
  typeof accountProfileOutput,
  AccountCommandDeps
>({
  name: "account.createUsername",
  input: createAccountUsernameInput,
  output: accountProfileOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkUserActor(ctx);
    const username = input.username.trim().toLowerCase();

    try {
      const currentUser = await deps.clerk.users.getUser(actor.userId);
      if (currentUser.username) {
        if (currentUser.username === username) {
          return toAccountProfile(currentUser);
        }

        throw new ValidationError(
          "USERNAME_ALREADY_SET",
          "Username has already been set",
          { username }
        );
      }

      let operation = await deps.startNamespaceOperation(deps.db, {
        clerkUserId: actor.userId,
        idempotencyKey: input.idempotencyKey,
        operationType: "create_user_username",
        ownerKind: "user",
        toHandle: username,
      });

      operation = await deps.reserveNamespaceForOperation(deps.db, operation);

      if (operation.status === "failed") {
        throw new ConflictError(
          "USERNAME_SETUP_FAILED",
          operation.errorMessage ?? "Username setup failed",
          { username }
        );
      }

      if (operation.status === "finalized") {
        return toAccountProfile(await deps.clerk.users.getUser(actor.userId));
      }

      if (operation.status === "clerk_applied") {
        await deps.finalizeNamespaceOperation(deps.db, operation);
        return toAccountProfile(await deps.clerk.users.getUser(actor.userId));
      }

      if (operation.status !== "namespace_reserved") {
        throw new InternalDomainError(
          "USERNAME_NAMESPACE_UNEXPECTED_STATUS",
          `Unexpected username operation status: ${operation.status}`,
          { status: operation.status, username }
        );
      }

      let updatedUser: AccountProfileUser;
      try {
        updatedUser = await deps.clerk.users.updateUser(actor.userId, {
          username,
        });
      } catch (error) {
        if (deps.isClerkConflictError(error)) {
          await deps.deletePreClerkNamespaceReservation(deps.db, operation, {
            errorCode: "CLERK_USERNAME_CONFLICT",
            errorMessage: `Clerk rejected username ${username} as already claimed`,
          });

          throw usernameConflict(username, error);
        }

        await deps.deletePreClerkNamespaceReservation(deps.db, operation, {
          errorCode: "CLERK_USERNAME_UPDATE_FAILED",
          errorMessage: `Clerk failed to set username ${username}`,
        });

        throw new InternalDomainError(
          "USERNAME_UPDATE_FAILED",
          "Failed to set username",
          { username },
          error instanceof Error ? { cause: error } : undefined
        );
      }

      operation = await deps.markNamespaceOperationClerkApplied(
        deps.db,
        operation
      );
      await deps.finalizeNamespaceOperation(deps.db, operation);

      return toAccountProfile(updatedUser);
    } catch (error) {
      if (
        error instanceof AuthzError ||
        error instanceof ConflictError ||
        error instanceof InternalDomainError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      if (error instanceof NamespaceConflictError) {
        throw namespaceConflictToDomainError(error, username);
      }

      deps.log.error("[account] create username failed", {
        userId: actor.userId,
        username,
        error: parseError(error),
      });

      throw new InternalDomainError(
        "USERNAME_CREATE_FAILED",
        "Failed to create username",
        { username },
        error instanceof Error ? { cause: error } : undefined
      );
    }
  },
});
