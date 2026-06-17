import type { Database } from "@db/app";
import {
  deletePreClerkNamespaceReservation,
  finalizeNamespaceOperation,
  markNamespaceOperationClerkApplied,
  NamespaceConflictError,
  reserveNamespaceForOperation,
  startNamespaceOperation,
} from "@db/app";
import { clerkOrgSlugSchema } from "@repo/app-validation";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import {
  isClerkConflictError,
  isClerkOrganizationDomainsNotEnabled,
} from "../../auth/clerk-errors";
import { listUserOrganizationMemberships } from "../../auth/clerk-org-membership";
import {
  getOrgAccessBySlug,
  isOrgAccessError,
  orgInitials,
} from "../../auth/organization-access";
import { defineCommand } from "../command";
import { ConflictError, InternalDomainError, NotFoundError } from "../errors";
import {
  requireActiveClerkOrgActor,
  requireClerkOrgAdminActor,
  requireClerkUserActor,
} from "../gates";

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;
type OrganizationMembership = Awaited<
  ReturnType<typeof listUserOrganizationMemberships>
>[number];

const AUTO_JOIN_DOMAIN_ENROLLMENT_MODE = "automatic_invitation" as const;
const MAX_ORGANIZATION_DOMAINS = 10;
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

type ClerkOrganizationClient = Pick<
  ClerkClient["organizations"],
  | "createOrganization"
  | "createOrganizationDomain"
  | "deleteOrganizationDomain"
  | "getOrganization"
  | "getOrganizationDomainList"
  | "updateOrganization"
  | "updateOrganizationDomain"
>;
type ClerkOrganizationDomain = Awaited<
  ReturnType<ClerkOrganizationClient["getOrganizationDomainList"]>
>["data"][number];

interface OrganizationCommandDeps {
  clerk: { organizations: ClerkOrganizationClient };
  db: Database;
  deletePreClerkNamespaceReservation: typeof deletePreClerkNamespaceReservation;
  finalizeNamespaceOperation: typeof finalizeNamespaceOperation;
  getOrgAccessBySlug: typeof getOrgAccessBySlug;
  isClerkConflictError: typeof isClerkConflictError;
  isClerkOrganizationDomainsNotEnabled: typeof isClerkOrganizationDomainsNotEnabled;
  listUserOrganizationMemberships: typeof listUserOrganizationMemberships;
  log: Pick<typeof log, "error" | "info" | "warn">;
  markNamespaceOperationClerkApplied: typeof markNamespaceOperationClerkApplied;
  reserveNamespaceForOperation: typeof reserveNamespaceForOperation;
  startNamespaceOperation: typeof startNamespaceOperation;
}

export function createDefaultOrganizationCommandDeps(input: {
  clerk: { organizations: ClerkOrganizationClient };
  db: Database;
  deletePreClerkNamespaceReservation?: typeof deletePreClerkNamespaceReservation;
  finalizeNamespaceOperation?: typeof finalizeNamespaceOperation;
  getOrgAccessBySlug?: typeof getOrgAccessBySlug;
  isClerkConflictError?: typeof isClerkConflictError;
  isClerkOrganizationDomainsNotEnabled?: typeof isClerkOrganizationDomainsNotEnabled;
  listUserOrganizationMemberships?: typeof listUserOrganizationMemberships;
  log?: Pick<typeof log, "error" | "info" | "warn">;
  markNamespaceOperationClerkApplied?: typeof markNamespaceOperationClerkApplied;
  reserveNamespaceForOperation?: typeof reserveNamespaceForOperation;
  startNamespaceOperation?: typeof startNamespaceOperation;
}): OrganizationCommandDeps;
export function createDefaultOrganizationCommandDeps(input: {
  clerk?: { organizations: ClerkOrganizationClient };
  db: Database;
  deletePreClerkNamespaceReservation?: typeof deletePreClerkNamespaceReservation;
  finalizeNamespaceOperation?: typeof finalizeNamespaceOperation;
  getOrgAccessBySlug?: typeof getOrgAccessBySlug;
  isClerkConflictError?: typeof isClerkConflictError;
  isClerkOrganizationDomainsNotEnabled?: typeof isClerkOrganizationDomainsNotEnabled;
  listUserOrganizationMemberships?: typeof listUserOrganizationMemberships;
  log?: Pick<typeof log, "error" | "info" | "warn">;
  markNamespaceOperationClerkApplied?: typeof markNamespaceOperationClerkApplied;
  reserveNamespaceForOperation?: typeof reserveNamespaceForOperation;
  startNamespaceOperation?: typeof startNamespaceOperation;
}): Promise<OrganizationCommandDeps>;
export function createDefaultOrganizationCommandDeps(input: {
  clerk?: { organizations: ClerkOrganizationClient };
  db: Database;
  deletePreClerkNamespaceReservation?: typeof deletePreClerkNamespaceReservation;
  finalizeNamespaceOperation?: typeof finalizeNamespaceOperation;
  getOrgAccessBySlug?: typeof getOrgAccessBySlug;
  isClerkConflictError?: typeof isClerkConflictError;
  isClerkOrganizationDomainsNotEnabled?: typeof isClerkOrganizationDomainsNotEnabled;
  listUserOrganizationMemberships?: typeof listUserOrganizationMemberships;
  log?: Pick<typeof log, "error" | "info" | "warn">;
  markNamespaceOperationClerkApplied?: typeof markNamespaceOperationClerkApplied;
  reserveNamespaceForOperation?: typeof reserveNamespaceForOperation;
  startNamespaceOperation?: typeof startNamespaceOperation;
}): OrganizationCommandDeps | Promise<OrganizationCommandDeps> {
  const base = {
    db: input.db,
    deletePreClerkNamespaceReservation:
      input.deletePreClerkNamespaceReservation ??
      deletePreClerkNamespaceReservation,
    finalizeNamespaceOperation:
      input.finalizeNamespaceOperation ?? finalizeNamespaceOperation,
    getOrgAccessBySlug: input.getOrgAccessBySlug ?? getOrgAccessBySlug,
    isClerkConflictError: input.isClerkConflictError ?? isClerkConflictError,
    isClerkOrganizationDomainsNotEnabled:
      input.isClerkOrganizationDomainsNotEnabled ??
      isClerkOrganizationDomainsNotEnabled,
    listUserOrganizationMemberships:
      input.listUserOrganizationMemberships ?? listUserOrganizationMemberships,
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

const listUserOrganizationsInput = z.object({}).strict();
const listUserOrganizationsOutput = z.custom<
  {
    id: string;
    imageUrl: string;
    initials: string;
    name: string;
    role: string;
    slug: string | null;
  }[]
>(Array.isArray);

const getOrganizationBySlugInput = z.object({
  slug: clerkOrgSlugSchema,
});
const getOrganizationBySlugOutput = z.custom<Awaited<
  ReturnType<typeof getOrgAccessBySlug>
> | null>((value) => typeof value === "object" && value !== null);

const createOrganizationInput = z.object({
  idempotencyKey: z.string().min(1).max(128),
  slug: clerkOrgSlugSchema,
});
const createOrganizationOutput = z.object({
  organizationId: z.string().min(1),
  slug: z.string().min(1),
});

const updateOrganizationNameInput = z.object({
  slug: z.string().min(1, "Organization slug is required"),
  name: clerkOrgSlugSchema,
});
const updateOrganizationNameOutput = z.object({
  success: z.literal(true),
  id: z.string().min(1),
  name: z.string().min(1),
});

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

const organizationDomainsInput = z.object({
  domains: z
    .array(organizationDomainSchema)
    .max(50)
    .transform((domains) => [...new Set(domains)])
    .pipe(z.array(z.string()).max(MAX_ORGANIZATION_DOMAINS)),
});
const organizationDomainsBySlugInput = z.object({
  slug: clerkOrgSlugSchema,
});
const organizationDomainsUpdateInput = organizationDomainsInput.extend({
  slug: clerkOrgSlugSchema,
});
const organizationDomainOutput = z.object({
  enrollmentMode: z.string().nullable().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  verificationStatus: z.string(),
});
const organizationDomainsListOutput = z.object({
  domains: z.array(organizationDomainOutput),
  enabled: z.boolean(),
});
const organizationDomainsUpdateOutput = z.array(organizationDomainOutput);

function mapMembership(membership: OrganizationMembership) {
  return {
    id: membership.organization.id,
    slug: membership.organization.slug,
    name: membership.organization.name,
    initials: orgInitials(membership.organization.name),
    role: membership.role,
    imageUrl: membership.organization.imageUrl,
  };
}

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

function sortDomainResponses(domains: ReturnType<typeof domainResponse>[]) {
  return [...domains].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

async function listOrganizationDomains(
  deps: OrganizationCommandDeps,
  organizationId: string
) {
  const result = await deps.clerk.organizations.getOrganizationDomainList({
    limit: 100,
    organizationId,
  });
  return result.data;
}

async function listOrganizationDomainsWithAvailability(
  deps: OrganizationCommandDeps,
  organizationId: string
) {
  try {
    return {
      domains: await listOrganizationDomains(deps, organizationId),
      enabled: true,
    };
  } catch (error) {
    if (deps.isClerkOrganizationDomainsNotEnabled(error)) {
      deps.log.warn("[organization] domains unavailable", {
        organizationId,
        error: parseError(error),
      });
      return { domains: [], enabled: false };
    }
    throw error;
  }
}

async function getOrganizationAccessBySlugOrThrow(input: {
  deps: OrganizationCommandDeps;
  slug: string;
  userId: string;
}) {
  try {
    return await input.deps.getOrgAccessBySlug({
      db: input.deps.db,
      slug: input.slug,
      userId: input.userId,
    });
  } catch (error) {
    if (isOrgAccessError(error)) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.", {
        slug: input.slug,
      });
    }
    throw error;
  }
}

function organizationConflict(handle: string, cause?: unknown) {
  return new ConflictError(
    "ORG_HANDLE_CONFLICT",
    `An organization with the name "${handle}" already exists`,
    { handle },
    cause instanceof Error ? { cause } : undefined
  );
}

function namespaceConflictToDomainError(
  error: NamespaceConflictError,
  handle: string
) {
  switch (error.code) {
    case "HANDLE_ALREADY_CLAIMED":
    case "OWNER_ALREADY_CLAIMED":
    case "OWNER_NAMESPACE_IN_PROGRESS":
    case "IDEMPOTENCY_KEY_REUSED":
      return organizationConflict(handle, error);
    case "OWNER_MISMATCH":
      return new ConflictError(
        "ORG_NAMESPACE_OWNER_MISMATCH",
        "Organization namespace operation owner mismatch",
        { handle },
        { cause: error }
      );
    default:
      return new InternalDomainError(
        "ORG_NAMESPACE_UNKNOWN_CONFLICT",
        "Unknown organization namespace conflict",
        { handle, code: error.code },
        { cause: error }
      );
  }
}

export const listUserOrganizationsCommand = defineCommand<
  "organizations.listUserOrganizations",
  typeof listUserOrganizationsInput,
  typeof listUserOrganizationsOutput,
  OrganizationCommandDeps
>({
  name: "organizations.listUserOrganizations",
  input: listUserOrganizationsInput,
  output: listUserOrganizationsOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireClerkUserActor(ctx);
    const memberships = await deps.listUserOrganizationMemberships({
      userId: actor.userId,
    });

    return memberships.map(mapMembership);
  },
});

export const getOrganizationBySlugCommand = defineCommand<
  "organizations.getBySlug",
  typeof getOrganizationBySlugInput,
  typeof getOrganizationBySlugOutput,
  OrganizationCommandDeps
>({
  name: "organizations.getBySlug",
  input: getOrganizationBySlugInput,
  output: getOrganizationBySlugOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkUserActor(ctx);
    try {
      return await deps.getOrgAccessBySlug({
        db: deps.db,
        slug: input.slug,
        userId: actor.userId,
      });
    } catch (error) {
      if (isOrgAccessError(error)) {
        throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.", {
          slug: input.slug,
        });
      }
      throw error;
    }
  },
});

export const listOrganizationDomainsCommand = defineCommand<
  "organizations.listDomains",
  typeof organizationDomainsBySlugInput,
  typeof organizationDomainsListOutput,
  OrganizationCommandDeps
>({
  name: "organizations.listDomains",
  input: organizationDomainsBySlugInput,
  output: organizationDomainsListOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkUserActor(ctx);
    const access = await getOrganizationAccessBySlugOrThrow({
      deps,
      slug: input.slug,
      userId: actor.userId,
    });
    const domainResult = await listOrganizationDomainsWithAvailability(
      deps,
      access.org.id
    );

    return {
      domains: sortDomainResponses(domainResult.domains.map(domainResponse)),
      enabled: domainResult.enabled,
    };
  },
});

export const updateOrganizationDomainsCommand = defineCommand<
  "organizations.updateDomains",
  typeof organizationDomainsUpdateInput,
  typeof organizationDomainsUpdateOutput,
  OrganizationCommandDeps
>({
  name: "organizations.updateDomains",
  input: organizationDomainsUpdateInput,
  output: organizationDomainsUpdateOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    const access = await getOrganizationAccessBySlugOrThrow({
      deps,
      slug: input.slug,
      userId: actor.userId,
    });

    if (access.org.id !== actor.orgId) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.", {
        slug: input.slug,
      });
    }

    try {
      const existingDomains = await listOrganizationDomains(
        deps,
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
            return deps.clerk.organizations.createOrganizationDomain({
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
            return deps.clerk.organizations.updateOrganizationDomain({
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
          deps.clerk.organizations.deleteOrganizationDomain({
            domainId: domain.id,
            organizationId: access.org.id,
          })
        )
      );

      const domains = await listOrganizationDomains(deps, access.org.id);

      return sortDomainResponses(domains.map(domainResponse));
    } catch (error) {
      if (deps.isClerkOrganizationDomainsNotEnabled(error)) {
        throw new InternalDomainError(
          "ORG_DOMAINS_UNAVAILABLE",
          "Organization domains are not enabled for this Clerk instance.",
          { slug: input.slug },
          error instanceof Error ? { cause: error } : undefined
        );
      }
      throw error;
    }
  },
});

export const createOrganizationCommand = defineCommand<
  "organizations.create",
  typeof createOrganizationInput,
  typeof createOrganizationOutput,
  OrganizationCommandDeps
>({
  name: "organizations.create",
  input: createOrganizationInput,
  output: createOrganizationOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkUserActor(ctx);
    const slug = input.slug.trim().toLowerCase();

    deps.log.info("[organization] create", {
      slug,
      userId: actor.userId,
      hasActiveOrg: Boolean(actor.orgId),
    });

    try {
      let operation = await deps.startNamespaceOperation(deps.db, {
        clerkUserId: actor.userId,
        idempotencyKey: input.idempotencyKey,
        operationType: "create_org_slug",
        ownerKind: "org",
        toHandle: slug,
      });

      operation = await deps.reserveNamespaceForOperation(deps.db, operation);

      if (operation.status === "failed") {
        throw organizationConflict(
          slug,
          new Error(
            operation.errorMessage ??
              `An organization with the name "${slug}" already exists`
          )
        );
      }

      if (operation.status === "finalized" && operation.clerkOrgId) {
        return {
          organizationId: operation.clerkOrgId,
          slug: operation.toHandle,
        };
      }

      if (operation.status === "clerk_applied" && operation.clerkOrgId) {
        await deps.finalizeNamespaceOperation(deps.db, operation);
        return {
          organizationId: operation.clerkOrgId,
          slug: operation.toHandle,
        };
      }

      if (operation.status !== "namespace_reserved") {
        throw new InternalDomainError(
          "ORG_NAMESPACE_UNEXPECTED_STATUS",
          `Unexpected organization namespace operation status: ${operation.status}`,
          { status: operation.status }
        );
      }

      let clerkOrg: Awaited<
        ReturnType<ClerkOrganizationClient["createOrganization"]>
      >;
      try {
        clerkOrg = await deps.clerk.organizations.createOrganization({
          name: slug,
          slug,
          createdBy: actor.userId,
        });
      } catch (error) {
        if (deps.isClerkConflictError(error)) {
          await deps.deletePreClerkNamespaceReservation(deps.db, operation, {
            errorCode: "CLERK_ORG_SLUG_CONFLICT",
            errorMessage: `Clerk rejected org slug ${slug} as already claimed`,
          });
          throw organizationConflict(slug, error);
        }

        await deps.deletePreClerkNamespaceReservation(deps.db, operation, {
          errorCode: "CLERK_ORG_CREATE_FAILED",
          errorMessage: `Clerk failed to create organization ${slug}`,
        });
        throw error;
      }

      operation = await deps.markNamespaceOperationClerkApplied(
        deps.db,
        operation,
        { clerkOrgId: clerkOrg.id }
      );
      await deps.finalizeNamespaceOperation(deps.db, operation);

      return {
        organizationId: clerkOrg.id,
        slug: clerkOrg.slug || slug,
      };
    } catch (error) {
      if (
        error instanceof ConflictError ||
        error instanceof InternalDomainError
      ) {
        throw error;
      }

      if (error instanceof NamespaceConflictError) {
        throw namespaceConflictToDomainError(error, slug);
      }

      deps.log.error("[organization] create failed", {
        slug,
        userId: actor.userId,
        error: parseError(error),
        errorDetails: error,
      });

      if (deps.isClerkConflictError(error)) {
        throw organizationConflict(slug, error);
      }

      throw new InternalDomainError(
        "ORG_CREATE_FAILED",
        "Failed to create organization",
        { slug },
        error instanceof Error ? { cause: error } : undefined
      );
    }
  },
});

export const updateOrganizationNameCommand = defineCommand<
  "organizations.updateName",
  typeof updateOrganizationNameInput,
  typeof updateOrganizationNameOutput,
  OrganizationCommandDeps
>({
  name: "organizations.updateName",
  input: updateOrganizationNameInput,
  output: updateOrganizationNameOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    const nextName = input.name.trim().toLowerCase();
    const activeActor = requireActiveClerkOrgActor(ctx);

    try {
      const org = await deps.clerk.organizations.getOrganization({
        slug: input.slug,
      });

      if (org.id !== activeActor.orgId) {
        throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.", {
          slug: input.slug,
        });
      }

      await deps.clerk.organizations.updateOrganization(org.id, {
        name: nextName,
        slug: nextName,
      });

      deps.log.info("[organization] updateName success", {
        organizationId: org.id,
        slug: nextName,
        userId: actor.userId,
      });

      return {
        success: true as const,
        id: org.id,
        name: nextName,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      deps.log.error("[organization] updateName failed", {
        slug: input.slug,
        userId: actor.userId,
        error: parseError(error),
      });

      if (deps.isClerkConflictError(error)) {
        throw organizationConflict(nextName, error);
      }

      throw new InternalDomainError(
        "ORG_UPDATE_NAME_FAILED",
        "Failed to update organization",
        { slug: input.slug },
        error instanceof Error ? { cause: error } : undefined
      );
    }
  },
});
