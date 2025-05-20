import { TRPCError } from "@trpc/server";
import { ResultAsync } from "neverthrow";

import type { TRPCPureServerProvider } from "@repo/trpc-client/trpc-pure-server-provider";
import type { User } from "@vendor/db/lightfast/schema";

// --- Error Types ---
export class UserNotFoundError extends Error {
  constructor(email: string) {
    super(`User with email ${email} not found.`);
    this.name = "UserNotFoundError";
  }
}

export class UserCreationConflictError extends Error {
  constructor(email: string) {
    super(
      `User creation conflicted for email ${email}. The user likely already exists.`,
    );
    this.name = "UserCreationConflictError";
  }
}

export class UserCreationError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "UserCreationError";
    this.cause = cause;
  }
}

export class UserFetchError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "UserFetchError";
    this.cause = cause;
  }
}

export class UserIndeterminateStateError extends Error {
  constructor(email: string) {
    super(
      `User ID for ${email} could not be determined after get/create process.`,
    );
    this.name = "UserIndeterminateStateError";
  }
}

export class UserUnknownError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "UserUnknownError";
    this.cause = cause;
  }
}

export type UserOperationError =
  | UserNotFoundError
  | UserCreationConflictError
  | UserCreationError
  | UserFetchError
  | UserIndeterminateStateError
  | UserUnknownError;

// --- Unsafe Operations ---

/**
 * Fetches a user by email. Throws specific errors on failure.
 */
export const fetchUserByEmailUnsafe = async (
  trpc: TRPCPureServerProvider,
  email: string,
): Promise<User> => {
  try {
    const user = await trpc.tenant.user.getByEmail({ email: email });
    return user;
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.code === "NOT_FOUND") {
        throw new UserNotFoundError(email);
      }
      throw new UserFetchError(
        `Failed to fetch user ${email}: ${error.message}`,
        error,
      );
    }
    throw new UserFetchError(
      `An unexpected error occurred while fetching user ${email}.`,
      error,
    );
  }
};

/**
 * Creates a new user. Throws specific errors on failure.
 */
export const createUserUnsafe = async (
  trpc: TRPCPureServerProvider,
  email: string,
): Promise<User> => {
  try {
    const newUser = await trpc.app.user.create({ email });
    return newUser;
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.code === "CONFLICT") {
        throw new UserCreationConflictError(email);
      }
      throw new UserCreationError(
        `Failed to create user ${email}: ${error.message}`,
        error,
      );
    }
    throw new UserCreationError(
      `An unexpected error occurred while creating user ${email}.`,
      error,
    );
  }
};

// --- Safe Operations ---

export const fetchUserByEmailSafe = (
  trpc: TRPCPureServerProvider,
  email: string,
) =>
  ResultAsync.fromPromise(
    fetchUserByEmailUnsafe(trpc, email),
    (error): UserFetchError | UserNotFoundError | UserUnknownError => {
      if (
        error instanceof UserNotFoundError ||
        error instanceof UserFetchError
      ) {
        return error;
      }
      return new UserUnknownError(
        error instanceof Error
          ? error.message
          : "Unknown error while fetching user by email.",
        error,
      );
    },
  );

export const createUserSafe = (trpc: TRPCPureServerProvider, email: string) =>
  ResultAsync.fromPromise(
    createUserUnsafe(trpc, email),
    (
      error,
    ): UserCreationConflictError | UserCreationError | UserUnknownError => {
      if (
        error instanceof UserCreationConflictError ||
        error instanceof UserCreationError
      ) {
        return error;
      }
      return new UserUnknownError(
        error instanceof Error
          ? error.message
          : "Unknown error while creating user.",
        error,
      );
    },
  );
