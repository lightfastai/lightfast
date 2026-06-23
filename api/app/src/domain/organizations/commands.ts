import type { Database } from "@db/app";
import type { OrgSetupGate } from "@repo/api-contract";
import { clerkOrgSlugSchema } from "@repo/app-validation";
import { z } from "zod";

import { defineCommand } from "../command";
import { ConflictError, InternalDomainError, NotFoundError } from "../errors";
import {
  requireActiveClerkOrgActor,
  requireClerkOrgAdminActor,
  requireClerkUserActor,
} from "../gates";

const AUTO_JOIN_DOMAIN_ENROLLMENT_MODE = "automatic_invitation" as const;
const MAX_ORGANIZATION_DOMAINS = 10;
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

interface OrganizationMembership {
  organization: {
    id: string;
    imageUrl: string;
    name: string;
    slug: string | null;
  };
  role: string;
}

export type OrganizationAccess = OrgSetupGate & {
  org: {
    id: string;
    imageUrl: string;
    initials: string;
    name: string;
    slug: string;
  };
  role: string;
};

interface ClerkOrganizationDomain {
  enrollmentMode?: string | null;
  id: string;
  name: string;
  verification?: { status?: string | null } | null;
}

interface ClerkOrganizationClient {
  createOrganization(input: {
    createdBy: string;
    name: string;
    slug: string;
  }): Promise<{ id: string; slug?: string | null }>;
  createOrganizationDomain(input: {
    enrollmentMode: typeof AUTO_JOIN_DOMAIN_ENROLLMENT_MODE;
    name: string;
    organizationId: string;
    verified: true;
  }): Promise<unknown>;
  deleteOrganizationDomain(input: {
    domainId: string;
    organizationId: string;
  }): Promise<unknown>;
  getOrganization(input: { slug: string }): Promise<{ id: string }>;
  getOrganizationDomainList(input: {
    limit: number;
    organizationId: string;
  }): Promise<{ data: ClerkOrganizationDomain[] }>;
  updateOrganization(
    organizationId: string,
    input: { name: string; slug: string }
  ): Promise<unknown>;
  updateOrganizationDomain(input: {
    domainId: string;
    enrollmentMode: typeof AUTO_JOIN_DOMAIN_ENROLLMENT_MODE;
    organizationId: string;
    verified: true;
  }): Promise<unknown>;
}

type NamespaceConflictCode =
  | "HANDLE_ALREADY_CLAIMED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "OWNER_ALREADY_CLAIMED"
  | "OWNER_NAMESPACE_IN_PROGRESS"
  | "OWNER_MISMATCH";

interface NamespaceOperation {
  clerkOrgId: string | null;
  clerkUserId: string | null;
  errorMessage?: string | null;
  id: number;
  operationType: string;
  ownerKind: string;
  status:
    | "clerk_applied"
    | "compensating"
    | "failed"
    | "finalized"
    | "namespace_reserved"
    | "started";
  toHandle: string;
}

interface NamespaceConflictLike {
  code: NamespaceConflictCode;
}

interface OrganizationLog {
  error(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

export interface OrganizationCommandDeps {
  clerk: { organizations: ClerkOrganizationClient };
  db: Database;
  deletePreClerkNamespaceReservation(
    db: Database,
    operation: NamespaceOperation,
    input: { errorCode: string; errorMessage: string }
  ): Promise<NamespaceOperation>;
  finalizeNamespaceOperation(
    db: Database,
    operation: NamespaceOperation
  ): Promise<NamespaceOperation>;
  getOrgAccessBySlug(input: {
    db: Database;
    slug: string;
    userId: string;
  }): Promise<OrganizationAccess>;
  isClerkConflictError(error: unknown): boolean;
  isClerkOrganizationDomainsNotEnabled(error: unknown): boolean;
  isNamespaceConflictError(error: unknown): error is NamespaceConflictLike;
  isOrgAccessError(error: unknown): boolean;
  listUserOrganizationMemberships(input: {
    userId: string;
  }): Promise<OrganizationMembership[]>;
  log: OrganizationLog;
  markNamespaceOperationClerkApplied(
    db: Database,
    operation: NamespaceOperation,
    input: { clerkOrgId: string }
  ): Promise<NamespaceOperation>;
  parseError(error: unknown): unknown;
  reserveNamespaceForOperation(
    db: Database,
    operation: NamespaceOperation
  ): Promise<NamespaceOperation>;
  startNamespaceOperation(
    db: Database,
    input: {
      clerkUserId: string;
      idempotencyKey: string;
      operationType: "create_org_slug";
      ownerKind: "org";
      toHandle: string;
    }
  ): Promise<NamespaceOperation>;
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
const getOrganizationBySlugOutput = z.custom<OrganizationAccess | null>(
  (value) => typeof value === "object" && value !== null
);

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

function orgInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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
        error: deps.parseError(error),
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
    if (input.deps.isOrgAccessError(error)) {
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
  error: NamespaceConflictLike,
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
      if (deps.isOrgAccessError(error)) {
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
    const parsedInput = organizationDomainsUpdateInput.parse(input);
    const actor = requireClerkOrgAdminActor(ctx);
    const access = await getOrganizationAccessBySlugOrThrow({
      deps,
      slug: parsedInput.slug,
      userId: actor.userId,
    });

    if (access.org.id !== actor.orgId) {
      throw new NotFoundError("ORG_NOT_FOUND", "Organization not found.", {
        slug: parsedInput.slug,
      });
    }

    try {
      const existingDomains = await listOrganizationDomains(
        deps,
        access.org.id
      );
      const nextDomainNames = new Set(parsedInput.domains);
      const existingByName = new Map(
        existingDomains.map((domain) => [domain.name.toLowerCase(), domain])
      );
      const domainsToDelete = existingDomains.filter(
        (domain) => !nextDomainNames.has(domain.name.toLowerCase())
      );

      await Promise.all(
        parsedInput.domains.map((name) => {
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
          { slug: parsedInput.slug },
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

      if (deps.isNamespaceConflictError(error)) {
        throw namespaceConflictToDomainError(error, slug);
      }

      deps.log.error("[organization] create failed", {
        slug,
        userId: actor.userId,
        error: deps.parseError(error),
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
        error: deps.parseError(error),
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
