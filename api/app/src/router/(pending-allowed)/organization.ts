import { clerkOrgSlugSchema } from "@repo/app-validation";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import { isClerkOrganizationDomainsNotEnabled } from "../../auth/clerk-errors";
import {
  getOrgAccessBySlug,
  isOrgAccessError,
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

function organizationDomainsUnavailableError(error: unknown) {
  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Organization domains are not enabled for this Clerk instance.",
    cause: error,
  });
}

async function listOrganizationDomainsWithAvailability(
  clerk: ClerkClient,
  organizationId: string
) {
  try {
    return {
      domains: await listOrganizationDomains(clerk, organizationId),
      enabled: true,
    };
  } catch (error) {
    if (isClerkOrganizationDomainsNotEnabled(error)) {
      log.warn("[organization] domains unavailable", {
        organizationId,
        error: parseError(error),
      });
      return { domains: [], enabled: false };
    }
    throw error;
  }
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
      const domainResult = await listOrganizationDomainsWithAvailability(
        clerk,
        access.org.id
      );

      return {
        domains: sortDomainResponses(domainResult.domains.map(domainResponse)),
        enabled: domainResult.enabled,
      };
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
      try {
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
      } catch (error) {
        if (isClerkOrganizationDomainsNotEnabled(error)) {
          throw organizationDomainsUnavailableError(error);
        }
        throw error;
      }
    }),
} satisfies TRPCRouterRecord;
