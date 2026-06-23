import { githubUserAccountReturnToSchema } from "@lightfast/connector-github/contract";
import {
  accountSettingsFormSchema,
  lightfastHandleSchema,
} from "@repo/app-validation";
import { z } from "zod";

import { defineCommand } from "../command";
import {
  AuthzError,
  ConflictError,
  InternalDomainError,
  ValidationError,
} from "../errors";
import { requireClerkUserActor } from "../gates";
import { type AccountProfileUser, toAccountProfile } from "./profile";

interface AccountUserClient {
  getUser(userId: string): Promise<AccountProfileUser>;
  isUsernameConflictError(error: unknown): boolean;
  updateUser(
    userId: string,
    params: {
      firstName?: string;
      lastName?: string;
      username?: string;
    }
  ): Promise<AccountProfileUser>;
}

interface GitHubAccountStatusResult {
  account: null | {
    accessTokenExpiresAt: Date;
    connectedAt: Date;
    provider: "github";
    providerUserId: string;
    refreshTokenExpiresAt: Date;
    status: "active";
  };
}

type NamespaceConflictCode =
  | "HANDLE_ALREADY_CLAIMED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "OWNER_ALREADY_CLAIMED"
  | "OWNER_NAMESPACE_IN_PROGRESS"
  | "OWNER_MISMATCH";

interface NamespaceConflictLike {
  code: NamespaceConflictCode;
}

type AccountUsernameNamespaceOperationType =
  | "backfill_existing_handle"
  | "create_org_slug"
  | "create_user_username";

type AccountUsernameNamespaceOwnerKind = "org" | "user";

type AccountUsernameNamespaceOperationStatus =
  | "clerk_applied"
  | "compensating"
  | "failed"
  | "finalized"
  | "namespace_reserved"
  | "started";

export interface AccountUsernameNamespaceOperation {
  clerkOrgId: string | null;
  clerkUserId: string | null;
  createdAt: Date;
  errorCode: string | null;
  errorMessage: string | null;
  expiresAt: Date | null;
  fromHandle: string | null;
  id: number;
  idempotencyClerkOrgId: string | null;
  idempotencyClerkUserId: string | null;
  idempotencyKey: string;
  operationType: AccountUsernameNamespaceOperationType;
  ownerKind: AccountUsernameNamespaceOwnerKind;
  status: AccountUsernameNamespaceOperationStatus;
  toHandle: string;
  updatedAt: Date;
}

interface AccountUsernameNamespace {
  deletePreClerkReservation(
    operation: AccountUsernameNamespaceOperation,
    input: { errorCode: string; errorMessage: string }
  ): Promise<AccountUsernameNamespaceOperation>;
  finalize(
    operation: AccountUsernameNamespaceOperation
  ): Promise<AccountUsernameNamespaceOperation>;
  isConflict(error: unknown): boolean;
  markClerkApplied(
    operation: AccountUsernameNamespaceOperation
  ): Promise<AccountUsernameNamespaceOperation>;
  reserve(
    operation: AccountUsernameNamespaceOperation
  ): Promise<AccountUsernameNamespaceOperation>;
  start(input: {
    clerkUserId: string;
    idempotencyKey: string;
    operationType: "create_user_username";
    ownerKind: "user";
    toHandle: string;
  }): Promise<AccountUsernameNamespaceOperation>;
}

export interface AccountCommandDeps {
  disconnectGitHubUserAccount(input: {
    clerkUserId: string;
  }): Promise<{ ok: true }>;
  getGitHubUserAccountStatus(input: {
    clerkUserId: string;
  }): Promise<GitHubAccountStatusResult>;
  log: { error(message: string, context: Record<string, unknown>): void };
  parseError(error: unknown): unknown;
  startGitHubUserAccountBinding(input: {
    lightfastUserId: string;
    returnTo?: string;
  }): Promise<{ authorizationUrl: string }>;
  usernameNamespace: AccountUsernameNamespace;
  users: AccountUserClient;
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

const githubAccountInput = z.object({}).strict();
const startGitHubAccountBindingInput = z
  .object({
    returnTo: githubUserAccountReturnToSchema.optional(),
  })
  .strict();
const githubAccountStatusOutput = z.object({
  account: z
    .object({
      accessTokenExpiresAt: z.date(),
      connectedAt: z.date(),
      provider: z.literal("github"),
      providerUserId: z.string().min(1),
      refreshTokenExpiresAt: z.date(),
      status: z.literal("active"),
    })
    .nullable(),
});
const startGitHubAccountBindingOutput = z.object({
  authorizationUrl: z.string().url(),
});
const disconnectGitHubAccountOutput = z.object({
  ok: z.literal(true),
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
  error: NamespaceConflictLike,
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
      const user = await deps.users.getUser(actor.userId);
      return toAccountProfile(user);
    } catch (error) {
      deps.log.error("[account] get profile failed", {
        userId: actor.userId,
        error: deps.parseError(error),
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
      const user = await deps.users.updateUser(actor.userId, {
        firstName: input.displayName,
        lastName: "",
      });

      return toAccountProfile(user);
    } catch (error) {
      deps.log.error("[account] update display name failed", {
        userId: actor.userId,
        error: deps.parseError(error),
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
      const currentUser = await deps.users.getUser(actor.userId);
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

      let operation = await deps.usernameNamespace.start({
        clerkUserId: actor.userId,
        idempotencyKey: input.idempotencyKey,
        operationType: "create_user_username",
        ownerKind: "user",
        toHandle: username,
      });

      operation = await deps.usernameNamespace.reserve(operation);

      if (operation.status === "failed") {
        throw new ConflictError(
          "USERNAME_SETUP_FAILED",
          operation.errorMessage ?? "Username setup failed",
          { username }
        );
      }

      if (operation.status === "finalized") {
        return toAccountProfile(await deps.users.getUser(actor.userId));
      }

      if (operation.status === "clerk_applied") {
        await deps.usernameNamespace.finalize(operation);
        return toAccountProfile(await deps.users.getUser(actor.userId));
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
        updatedUser = await deps.users.updateUser(actor.userId, {
          username,
        });
      } catch (error) {
        if (deps.users.isUsernameConflictError(error)) {
          await deps.usernameNamespace.deletePreClerkReservation(operation, {
            errorCode: "CLERK_USERNAME_CONFLICT",
            errorMessage: `Clerk rejected username ${username} as already claimed`,
          });

          throw usernameConflict(username, error);
        }

        await deps.usernameNamespace.deletePreClerkReservation(operation, {
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

      operation = await deps.usernameNamespace.markClerkApplied(operation);
      await deps.usernameNamespace.finalize(operation);

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

      if (deps.usernameNamespace.isConflict(error)) {
        throw namespaceConflictToDomainError(
          error as NamespaceConflictLike,
          username
        );
      }

      deps.log.error("[account] create username failed", {
        userId: actor.userId,
        username,
        error: deps.parseError(error),
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

export const getGitHubAccountStatusCommand = defineCommand<
  "account.github.status",
  typeof githubAccountInput,
  typeof githubAccountStatusOutput,
  AccountCommandDeps
>({
  name: "account.github.status",
  input: githubAccountInput,
  output: githubAccountStatusOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireClerkUserActor(ctx);
    return deps.getGitHubUserAccountStatus({ clerkUserId: actor.userId });
  },
});

export const startGitHubAccountBindingCommand = defineCommand<
  "account.github.start",
  typeof startGitHubAccountBindingInput,
  typeof startGitHubAccountBindingOutput,
  AccountCommandDeps
>({
  name: "account.github.start",
  input: startGitHubAccountBindingInput,
  output: startGitHubAccountBindingOutput,
  run: async ({ ctx, deps, input }) => {
    const parsedInput = startGitHubAccountBindingInput.safeParse(input);
    if (!parsedInput.success) {
      throw new ValidationError(
        "INVALID_INPUT",
        "Invalid GitHub account binding input.",
        { issues: parsedInput.error.issues }
      );
    }

    const actor = requireClerkUserActor(ctx);
    return deps.startGitHubUserAccountBinding({
      lightfastUserId: actor.userId,
      returnTo: parsedInput.data.returnTo,
    });
  },
});

export const syncGitHubAccountCommand = defineCommand<
  "account.github.sync",
  typeof githubAccountInput,
  typeof githubAccountStatusOutput,
  AccountCommandDeps
>({
  name: "account.github.sync",
  input: githubAccountInput,
  output: githubAccountStatusOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireClerkUserActor(ctx);
    return deps.getGitHubUserAccountStatus({ clerkUserId: actor.userId });
  },
});

export const disconnectGitHubAccountCommand = defineCommand<
  "account.github.disconnect",
  typeof githubAccountInput,
  typeof disconnectGitHubAccountOutput,
  AccountCommandDeps
>({
  name: "account.github.disconnect",
  input: githubAccountInput,
  output: disconnectGitHubAccountOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireClerkUserActor(ctx);
    return deps.disconnectGitHubUserAccount({ clerkUserId: actor.userId });
  },
});
