import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { pendingAllowedProcedure } from "../../trpc";

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

/**
 * Account Router
 *
 * Manages user account profile information from Clerk.
 * This router contains only non-table-based operations.
 *
 * Table-based operations have been moved to:
 * - API Keys: org-api-keys router (org-scoped)
 * - Integrations: user-sources router
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
  get: pendingAllowedProcedure.query(async ({ ctx }) => {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(ctx.auth.identity.userId);

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
} satisfies TRPCRouterRecord;
