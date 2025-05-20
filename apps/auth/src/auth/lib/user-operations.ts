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
    const user = await trpc.tenant.user.getByEmail({ email });
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

/**
 * Attempts to get a user by email. If not found, attempts to create the user.
 * If creation conflicts, attempts to fetch the user again.
 * Throws specific errors on failure at any step.
 */
export const getOrCreateUserUnsafe = async (
  trpc: TRPCPureServerProvider,
  email: string,
): Promise<User> => {
  try {
    return await fetchUserByEmailUnsafe(trpc, email);
  } catch (fetchError) {
    if (fetchError instanceof UserNotFoundError) {
      // User not found, try to create them
      try {
        return await createUserUnsafe(trpc, email);
      } catch (createError) {
        if (createError instanceof UserCreationConflictError) {
          // Creation conflicted, user was likely created concurrently. Try fetching again.
          try {
            return await fetchUserByEmailUnsafe(trpc, email);
          } catch (postConflictFetchError) {
            // If the second get fails, something is seriously wrong.
            console.error(
              `Failed to get user ${email} after conflict:`,
              postConflictFetchError,
            );
            throw new UserFetchError(
              `Failed to retrieve user ${email} after conflict during creation.`,
              postConflictFetchError,
            );
          }
        }
        // Creation failed for a reason other than CONFLICT
        console.error(`Failed to create user ${email}:`, createError);
        if (createError instanceof UserCreationError) throw createError;
        throw new UserCreationError( // Ensure it's always a UserCreationError
          `Failed to create user ${email}.`,
          createError,
        );
      }
    }
    // Initial getByEmail failed for a reason other than NOT_FOUND
    console.error(`Failed to get user by email ${email}:`, fetchError);
    if (fetchError instanceof UserFetchError) throw fetchError;
    throw new UserFetchError( // Ensure it's always a UserFetchError
      `Failed to retrieve user information for ${email}.`,
      fetchError,
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

export const getOrCreateUserSafe = (
  trpc: TRPCPureServerProvider,
  email: string,
) =>
  ResultAsync.fromPromise(
    getOrCreateUserUnsafe(trpc, email),
    (error): UserOperationError => {
      if (
        error instanceof UserNotFoundError ||
        error instanceof UserCreationConflictError ||
        error instanceof UserCreationError ||
        error instanceof UserFetchError ||
        error instanceof UserIndeterminateStateError
      ) {
        return error;
      }
      console.error("Unknown error in getOrCreateUserSafe:", error);
      return new UserUnknownError(
        error instanceof Error
          ? error.message
          : `Unknown error during get/create process for ${email}.`,
        error,
      );
    },
  );
