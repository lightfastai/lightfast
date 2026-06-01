import {
  deletePreClerkNamespaceReservation,
  finalizeNamespaceOperation,
  markNamespaceOperationClerkApplied,
  NamespaceConflictError,
  reserveNamespaceForOperation,
  startNamespaceOperation,
} from "@db/app";
import { lightfastHandleSchema } from "@repo/app-validation";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { User } from "@vendor/clerk/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import { isClerkConflictError } from "../../auth/clerk-errors";
import { viewerProcedure } from "../../trpc";

function deriveInitials(input: {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
}): string {
  const { firstName, lastName, fullName, username } = input;
  if (fullName) {
    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (lastName) {
    return lastName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return "LF";
}

type AccountProfileUser = Pick<
  User,
  | "createdAt"
  | "firstName"
  | "id"
  | "imageUrl"
  | "lastName"
  | "primaryEmailAddress"
  | "username"
>;

function toAccountProfile(user: AccountProfileUser) {
  const fullName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user.firstName ?? user.lastName ?? null);

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName,
    username: user.username,
    primaryEmailAddress: user.primaryEmailAddress?.emailAddress ?? null,
    imageUrl: user.imageUrl,
    initials: deriveInitials({
      firstName: user.firstName,
      lastName: user.lastName,
      fullName,
      username: user.username,
    }),
    createdAt: new Date(user.createdAt).toISOString(),
  };
}

function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const [firstName, ...rest] = parts;
  return {
    firstName: firstName ?? "",
    lastName: rest.length > 0 ? rest.join(" ") : null,
  };
}

function namespaceConflictToTRPCError(error: NamespaceConflictError): TRPCError {
  switch (error.code) {
    case "HANDLE_ALREADY_CLAIMED":
      return new TRPCError({
        code: "CONFLICT",
        message: "This username is already taken",
        cause: error,
      });
    case "OWNER_ALREADY_CLAIMED":
      return new TRPCError({
        code: "BAD_REQUEST",
        message: "Username has already been set",
        cause: error,
      });
    case "OWNER_NAMESPACE_IN_PROGRESS":
      return new TRPCError({
        code: "CONFLICT",
        message: "Username setup is already in progress",
        cause: error,
      });
    case "IDEMPOTENCY_KEY_REUSED":
      return new TRPCError({
        code: "CONFLICT",
        message: "This username request was already used with different input",
        cause: error,
      });
    case "OWNER_MISMATCH":
      return new TRPCError({
        code: "FORBIDDEN",
        message: "Username operation owner mismatch",
        cause: error,
      });
  }
}

const updateNameInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(128),
});

const createUsernameInput = z.object({
  idempotencyKey: z.string().min(1).max(128),
  username: lightfastHandleSchema,
});

/**
 * Account Router
 *
 * Manages user account profile information from Clerk.
 * This router contains only non-table-based operations.
 *
 * Table-based operations have been moved to:
 * - API Keys: org-api-keys router (org-scoped)
 * - Workspace memory: query and ingestion routers
 */

export const accountRouter = {
  /**
   * Get user profile information from Clerk
   *
   * Returns user data including:
   * - Full name
   * - Email addresses
   * - Username
   * - Profile image
   */
  get: viewerProcedure.query(async ({ ctx }) => {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(ctx.auth.identity.userId);

      return toAccountProfile(user);
    } catch (error: unknown) {
      log.error("[account] get profile failed", {
        userId: ctx.auth.identity.userId,
        error: parseError(error),
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch user profile",
        cause: error,
      });
    }
  }),

  updateName: viewerProcedure
    .input(updateNameInput)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      const { firstName, lastName } = splitDisplayName(input.name);

      try {
        const user = await clerk.users.updateUser(ctx.auth.identity.userId, {
          firstName,
          lastName: lastName ?? "",
        });

        return toAccountProfile(user);
      } catch (error: unknown) {
        log.error("[account] update name failed", {
          userId: ctx.auth.identity.userId,
          error: parseError(error),
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user name",
          cause: error,
        });
      }
    }),

  createUsername: viewerProcedure
    .input(createUsernameInput)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      const userId = ctx.auth.identity.userId;

      try {
        const currentUser = await clerk.users.getUser(userId);
        if (currentUser.username) {
          if (currentUser.username === input.username) {
            return toAccountProfile(currentUser);
          }

          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Username has already been set",
          });
        }

        let operation = await startNamespaceOperation(ctx.db, {
          clerkUserId: userId,
          idempotencyKey: input.idempotencyKey,
          operationType: "create_user_username",
          ownerKind: "user",
          toHandle: input.username,
        });

        operation = await reserveNamespaceForOperation(ctx.db, operation);

        if (operation.status === "failed") {
          throw new TRPCError({
            code: "CONFLICT",
            message: operation.errorMessage ?? "Username setup failed",
          });
        }

        if (operation.status === "finalized") {
          return toAccountProfile(await clerk.users.getUser(userId));
        }

        if (operation.status === "clerk_applied") {
          await finalizeNamespaceOperation(ctx.db, operation);
          return toAccountProfile(await clerk.users.getUser(userId));
        }

        if (operation.status !== "namespace_reserved") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Unexpected username operation status: ${operation.status}`,
          });
        }

        let updatedUser: User;
        try {
          updatedUser = await clerk.users.updateUser(userId, {
            username: input.username,
          });
        } catch (error: unknown) {
          if (isClerkConflictError(error)) {
            await deletePreClerkNamespaceReservation(ctx.db, operation, {
              errorCode: "CLERK_USERNAME_CONFLICT",
              errorMessage: `Clerk rejected username ${input.username} as already claimed`,
            });

            throw new TRPCError({
              code: "CONFLICT",
              message: "This username is already taken",
              cause: error,
            });
          }

          await deletePreClerkNamespaceReservation(ctx.db, operation, {
            errorCode: "CLERK_USERNAME_UPDATE_FAILED",
            errorMessage: `Clerk failed to set username ${input.username}`,
          });

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to set username",
            cause: error,
          });
        }

        operation = await markNamespaceOperationClerkApplied(ctx.db, operation);
        await finalizeNamespaceOperation(ctx.db, operation);

        return toAccountProfile(updatedUser);
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof NamespaceConflictError) {
          throw namespaceConflictToTRPCError(error);
        }

        log.error("[account] create username failed", {
          userId,
          username: input.username,
          error: parseError(error),
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create username",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;
