import { type Database, isOrgBound } from "@db/app";
import {
  type NativeClient,
  type NativeOrganization,
  type NativeSessionMetadata,
  nativeClientSchema,
  nativeCreateAttemptInputSchema,
  nativeFinalizeRequestSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { z } from "zod";

import {
  consumeNativeAuthAttempt,
  issueNativeAuthAttempt,
} from "../../auth/native-auth-attempts";
import {
  buildClerkAuthorizeUrl,
  getNativeOAuthConfig,
} from "../../auth/native-oauth";
import {
  nativeOAuthProcedure,
  publicProcedure,
  viewerProcedure,
} from "../../trpc";

function primaryEmail(user: {
  emailAddresses?: Array<{ emailAddress?: string; id?: string }>;
  primaryEmailAddressId?: string | null;
}): string | null {
  const primary = user.emailAddresses?.find(
    (email) => email.id === user.primaryEmailAddressId
  );
  return (
    primary?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null
  );
}

function requireNativeOAuthConfig(client: NativeClient) {
  const config = getNativeOAuthConfig(client);
  if (!config) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `${client} OAuth is not configured`,
    });
  }
  return config;
}

async function listMembershipsForUser(userId: string) {
  const clerk = await clerkClient();
  return clerk.users.getOrganizationMembershipList({ userId });
}

export async function listNativeOrganizationsForUser(input: {
  db: Database;
  userId: string;
}): Promise<NativeOrganization[]> {
  const memberships = await listMembershipsForUser(input.userId);
  return Promise.all(
    memberships.data.map(async (membership) => ({
      bindingStatus: (await isOrgBound(input.db, membership.organization.id))
        ? "bound"
        : "unbound",
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role,
      slug: membership.organization.slug,
    }))
  );
}

async function assertNativeOrgMembership(input: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  const memberships = await listMembershipsForUser(input.userId);
  const hasMembership = memberships.data.some(
    (membership) => membership.organization.id === input.organizationId
  );
  if (!hasMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not a member of the selected organization",
    });
  }
}

async function createNativeSessionMetadata(input: {
  client: NativeClient;
  db: Database;
  organizationId: string;
  userId: string;
}): Promise<NativeSessionMetadata> {
  const clerk = await clerkClient();
  const [user, organizations] = await Promise.all([
    clerk.users.getUser(input.userId),
    listNativeOrganizationsForUser({
      db: input.db,
      userId: input.userId,
    }),
  ]);
  const organization = organizations.find(
    (entry) => entry.id === input.organizationId
  );
  if (!organization) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not a member of the selected organization",
    });
  }

  return nativeSessionMetadataSchema.parse({
    client: input.client,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    user: {
      email: primaryEmail(user),
      id: input.userId,
    },
  });
}

export const nativeAuthRouter = {
  oauthConfig: publicProcedure
    .input(z.object({ client: nativeClientSchema }))
    .query(({ input }) => requireNativeOAuthConfig(input.client)),

  listOrganizations: viewerProcedure.query(async ({ ctx }) =>
    listNativeOrganizationsForUser({
      db: ctx.db,
      userId: ctx.auth.identity.userId,
    })
  ),

  createAttempt: viewerProcedure
    .input(nativeCreateAttemptInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertNativeOrgMembership({
        organizationId: input.organizationId,
        userId: ctx.auth.identity.userId,
      });
      const config = requireNativeOAuthConfig(input.client);
      const issued = await issueNativeAuthAttempt({
        ...input,
        userId: ctx.auth.identity.userId,
      });
      return {
        authorizationUrl: buildClerkAuthorizeUrl({
          codeChallenge: input.codeChallenge,
          config,
          redirectUri: input.redirectUri,
          state: issued.state,
        }),
        attemptId: issued.attemptId,
      };
    }),

  finalize: nativeOAuthProcedure
    .input(nativeFinalizeRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const attempt = await consumeNativeAuthAttempt({
        attemptId: input.attemptId,
        state: input.state,
      });
      if (!attempt || attempt.client !== input.client) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid native auth attempt",
        });
      }
      if (ctx.auth.access.userId !== attempt.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Native auth user mismatch",
        });
      }
      return createNativeSessionMetadata({
        db: ctx.db,
        client: input.client,
        organizationId: attempt.organizationId,
        userId: attempt.userId,
      });
    }),
} satisfies TRPCRouterRecord;
