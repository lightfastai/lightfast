import {
  deletePreClerkNamespaceReservation,
  finalizeNamespaceOperation,
  markNamespaceOperationClerkApplied,
  NamespaceConflictError,
  reserveNamespaceForOperation,
  startNamespaceOperation,
} from "@db/app";
import { clerkOrgSlugSchema } from "@repo/app-validation";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import { isClerkConflictError } from "../../auth/clerk-errors";
import { listUserOrganizationMemberships } from "../../auth/clerk-org-membership";
import {
  getOrgAccessBySlug,
  isOrgAccessError,
  orgInitials,
} from "../../auth/organization-access";
import { orgAdminProcedure, viewerProcedure } from "../../trpc";

const AUTO_JOIN_DOMAIN_ENROLLMENT_MODE = "automatic_invitation" as const;
const MAX_ORGANIZATION_DOMAINS = 10;
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;
type ClerkOrganizationDomain = Awaited<
  ReturnType<ClerkClient["organizations"]["getOrganizationDomainList"]>
>["data"][number];

function normalizeOrganizationDomainName(value: string) {
  const trimmed = value.trim().toLowerCase();
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let hostname = "";
  try {
    hostname = new URL(withProtocol).hostname;
  } catch {
    hostname = trimmed.split(/[/?#]/, 1)[0] ?? "";
  }

  return hostname
    .replace(/^\.+|\.+$/g, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

const organizationDomainSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeOrganizationDomainName(value);
  if (!DOMAIN_PATTERN.test(normalized)) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid domain, like lightfast.ai",
    });
    return z.NEVER;
  }
  return normalized;
});

const organizationDomainsInputSchema = z.object({
  domains: z
    .array(organizationDomainSchema)
    .max(50)
    .transform((domains) => [...new Set(domains)])
    .pipe(z.array(z.string()).max(MAX_ORGANIZATION_DOMAINS)),
});
const organizationDomainsBySlugInputSchema = z.object({
  slug: clerkOrgSlugSchema,
});
const organizationDomainsUpdateInputSchema =
  organizationDomainsInputSchema.extend({
    slug: clerkOrgSlugSchema,
  });

function domainVerificationStatus(domain: ClerkOrganizationDomain) {
  return domain.verification?.status ?? "unverified";
}

function domainEnrollmentMode(domain: ClerkOrganizationDomain) {
  return (
    domain.enrollmentMode ??
    (domain as { enrollment_mode?: ClerkOrganizationDomain["enrollmentMode"] })
      .enrollment_mode
  );
}

function domainResponse(domain: ClerkOrganizationDomain) {
  return {
    enrollmentMode: domainEnrollmentMode(domain),
    id: domain.id,
    name: domain.name.toLowerCase(),
    verificationStatus: domainVerificationStatus(domain),
  };
}

function sortDomainResponses(
  domains: ReturnType<typeof domainResponse>[]
): ReturnType<typeof domainResponse>[] {
  return [...domains].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

async function listOrganizationDomains(
  clerk: ClerkClient,
  organizationId: string
) {
  const result = await clerk.organizations.getOrganizationDomainList({
    limit: 100,
    organizationId,
  });
  return result.data;
}

async function getOrganizationAccessBySlugOrThrow(input: {
  ctx: { db: Parameters<typeof getOrgAccessBySlug>[0]["db"] };
  slug: string;
  userId: string;
}) {
  try {
    return await getOrgAccessBySlug({
      db: input.ctx.db,
      slug: input.slug,
      userId: input.userId,
    });
  } catch (error) {
    if (isOrgAccessError(error)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
        cause: error,
      });
    }
    throw error;
  }
}

function namespaceConflictToTRPCError(
  error: NamespaceConflictError,
  handle: string
): TRPCError {
  switch (error.code) {
    case "HANDLE_ALREADY_CLAIMED":
    case "OWNER_ALREADY_CLAIMED":
    case "OWNER_NAMESPACE_IN_PROGRESS":
    case "IDEMPOTENCY_KEY_REUSED":
      return new TRPCError({
        code: "CONFLICT",
        message: `An organization with the name "${handle}" already exists`,
        cause: error,
      });
    case "OWNER_MISMATCH":
      return new TRPCError({
        code: "FORBIDDEN",
        message: "Organization namespace operation owner mismatch",
        cause: error,
      });
    default:
      return new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unknown organization namespace conflict",
        cause: error,
      });
  }
}

/**
 * Organization router - Clerk-based organization management
 *
 * Phase 1.6: Organizations are managed entirely in Clerk (source of truth)
 * No database table for organizations - Clerk handles all org data
 */
export const organizationRouter = {
  /**
   * List user's organizations from Clerk
   *
   * Returns all organizations the authenticated user belongs to.
   * Used by org-switcher component in the header.
   */
  listUserOrganizations: viewerProcedure.query(async ({ ctx }) => {
    // viewerProcedure guarantees pending or active identity
    const userId = ctx.auth.identity.userId;
    const memberships = await listUserOrganizationMemberships({ userId });

    // Return Clerk organization data directly
    return memberships.map((membership) => {
      return {
        id: membership.organization.id, // Clerk org ID
        slug: membership.organization.slug,
        name: membership.organization.name,
        initials: orgInitials(membership.organization.name),
        role: membership.role,
        imageUrl: membership.organization.imageUrl,
      };
    });
  }),

  getBySlug: viewerProcedure
    .input(
      z.object({
        slug: clerkOrgSlugSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getOrgAccessBySlug({
          db: ctx.db,
          slug: input.slug,
          userId: ctx.auth.identity.userId,
        });
      } catch (error) {
        if (isOrgAccessError(error)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
            cause: error,
          });
        }
        throw error;
      }
    }),

  /**
   * Create organization
   * Creates a new Clerk organization with the user as admin
   *
   * Used by team creation flow at /account/teams/new
   * Does NOT create a default project - user sets up integrations separately
   */
  create: viewerProcedure
    .input(
      z.object({
        idempotencyKey: z.string().min(1).max(128),
        slug: clerkOrgSlugSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // viewerProcedure guarantees pending or active identity
      log.info("[organization] create", {
        slug: input.slug,
        userId: ctx.auth.identity.userId,
        authType: ctx.auth.identity.type,
      });

      const clerk = await clerkClient();

      try {
        let operation = await startNamespaceOperation(ctx.db, {
          clerkUserId: ctx.auth.identity.userId,
          idempotencyKey: input.idempotencyKey,
          operationType: "create_org_slug",
          ownerKind: "org",
          toHandle: input.slug,
        });

        operation = await reserveNamespaceForOperation(ctx.db, operation);

        if (operation.status === "failed") {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              operation.errorMessage ??
              `An organization with the name "${input.slug}" already exists`,
          });
        }

        if (operation.status === "finalized" && operation.clerkOrgId) {
          return {
            organizationId: operation.clerkOrgId,
            slug: operation.toHandle,
          };
        }

        if (operation.status === "clerk_applied" && operation.clerkOrgId) {
          await finalizeNamespaceOperation(ctx.db, operation);
          return {
            organizationId: operation.clerkOrgId,
            slug: operation.toHandle,
          };
        }

        if (operation.status !== "namespace_reserved") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Unexpected organization namespace operation status: ${operation.status}`,
          });
        }

        let clerkOrg;
        try {
          // Create Clerk organization (slug used for both name and slug)
          clerkOrg = await clerk.organizations.createOrganization({
            name: input.slug,
            slug: input.slug,
            createdBy: ctx.auth.identity.userId,
          });
        } catch (error: unknown) {
          if (isClerkConflictError(error)) {
            await deletePreClerkNamespaceReservation(ctx.db, operation, {
              errorCode: "CLERK_ORG_SLUG_CONFLICT",
              errorMessage: `Clerk rejected org slug ${input.slug} as already claimed`,
            });

            throw new TRPCError({
              code: "CONFLICT",
              message: `An organization with the name "${input.slug}" already exists`,
              cause: error,
            });
          }

          await deletePreClerkNamespaceReservation(ctx.db, operation, {
            errorCode: "CLERK_ORG_CREATE_FAILED",
            errorMessage: `Clerk failed to create organization ${input.slug}`,
          });

          throw error;
        }

        operation = await markNamespaceOperationClerkApplied(
          ctx.db,
          operation,
          { clerkOrgId: clerkOrg.id }
        );
        await finalizeNamespaceOperation(ctx.db, operation);

        return {
          organizationId: clerkOrg.id,
          slug: clerkOrg.slug || input.slug,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof NamespaceConflictError) {
          throw namespaceConflictToTRPCError(error, input.slug);
        }

        log.error("[organization] create failed", {
          slug: input.slug,
          userId: ctx.auth.identity.userId,
          error: parseError(error),
          errorDetails: error,
        });

        if (isClerkConflictError(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `An organization with the name "${input.slug}" already exists`,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create organization",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;

export const orgSettingsOrganizationRouter = {
  listDomains: viewerProcedure
    .input(organizationDomainsBySlugInputSchema)
    .query(async ({ ctx, input }) => {
      const access = await getOrganizationAccessBySlugOrThrow({
        ctx,
        slug: input.slug,
        userId: ctx.auth.identity.userId,
      });
      const clerk = await clerkClient();
      const domains = await listOrganizationDomains(clerk, access.org.id);

      return sortDomainResponses(domains.map(domainResponse));
    }),

  updateDomains: orgAdminProcedure
    .input(organizationDomainsUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const access = await getOrganizationAccessBySlugOrThrow({
        ctx,
        slug: input.slug,
        userId: ctx.auth.identity.userId,
      });

      if (access.org.id !== ctx.auth.identity.orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can perform this action",
        });
      }

      const clerk = await clerkClient();
      const existingDomains = await listOrganizationDomains(
        clerk,
        access.org.id
      );
      const nextDomainNames = new Set(input.domains);
      const existingByName = new Map(
        existingDomains.map((domain) => [domain.name.toLowerCase(), domain])
      );
      const domainsToDelete = existingDomains.filter(
        (domain) => !nextDomainNames.has(domain.name.toLowerCase())
      );

      await Promise.all(
        input.domains.map((name) => {
          const existingDomain = existingByName.get(name);
          if (!existingDomain) {
            return clerk.organizations.createOrganizationDomain({
              enrollmentMode: AUTO_JOIN_DOMAIN_ENROLLMENT_MODE,
              name,
              organizationId: access.org.id,
              verified: true,
            });
          }

          if (
            domainEnrollmentMode(existingDomain) !==
              AUTO_JOIN_DOMAIN_ENROLLMENT_MODE ||
            domainVerificationStatus(existingDomain) !== "verified"
          ) {
            return clerk.organizations.updateOrganizationDomain({
              domainId: existingDomain.id,
              enrollmentMode: AUTO_JOIN_DOMAIN_ENROLLMENT_MODE,
              organizationId: access.org.id,
              verified: true,
            });
          }

          return Promise.resolve(existingDomain);
        })
      );

      await Promise.all(
        domainsToDelete.map((domain) =>
          clerk.organizations.deleteOrganizationDomain({
            domainId: domain.id,
            organizationId: access.org.id,
          })
        )
      );

      const domains = await listOrganizationDomains(clerk, access.org.id);

      return sortDomainResponses(domains.map(domainResponse));
    }),

  /**
   * Update organization name
   * Used by team settings page to update the organization name/slug in Clerk
   *
   * Only organization admins can update the organization name
   */
  updateName: orgAdminProcedure
    .input(
      z.object({
        slug: z.string().min(1, "Organization slug is required"),
        name: clerkOrgSlugSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();

      try {
        // Get organization by slug
        const org = await clerk.organizations.getOrganization({
          slug: input.slug,
        });

        if (org.id !== ctx.auth.identity.orgId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only administrators can perform this action",
          });
        }

        // Update organization in Clerk
        await clerk.organizations.updateOrganization(org.id, {
          name: input.name,
          slug: input.name, // Clerk uses slug for URL-safe names
        });

        log.info("[organization] updateName success", {
          organizationId: org.id,
          slug: input.name,
          userId: ctx.auth.identity.userId,
        });

        return {
          success: true,
          id: org.id, // Return org ID for setActive calls
          name: input.name,
        };
      } catch (error: unknown) {
        // Re-throw TRPCError as-is
        if (error instanceof TRPCError) {
          throw error;
        }

        log.error("[organization] updateName failed", {
          slug: input.slug,
          userId: ctx.auth.identity.userId,
          error: parseError(error),
        });

        if (isClerkConflictError(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `An organization with the name "${input.name}" already exists`,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update organization",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;
