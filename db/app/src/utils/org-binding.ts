/**
 * Org Source-Control Binding repository helpers.
 *
 * The only shared DB interface the app/API layers need for the binding gate.
 * The DB row is the authoritative source of truth; Clerk org metadata is a
 * downstream mirror written by the API layer after these helpers succeed.
 *
 * Every helper takes the `db` client as its first argument so callers can pass
 * `ctx.db` and the helpers stay independently testable.
 */

import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import type { Database } from "../client";
import type {
  OrgSourceControlBinding,
  OrgSourceControlBindingProvider,
} from "../schema";
import { orgSourceControlBindings } from "../schema";

const { activeClerkOrgId: _activeClerkOrgId, ...bindingSelection } =
  getTableColumns(orgSourceControlBindings);

/**
 * Returns the org's single active source-control binding, or `undefined` when
 * the org is not bound.
 */
export async function getActiveOrgBinding(
  db: Database,
  clerkOrgId: string
): Promise<OrgSourceControlBinding | undefined> {
  const [row] = await db
    .select(bindingSelection)
    .from(orgSourceControlBindings)
    .where(
      and(
        eq(orgSourceControlBindings.clerkOrgId, clerkOrgId),
        eq(orgSourceControlBindings.status, "active")
      )
    )
    .limit(1);
  return row;
}

export type OrgSourceControlBindingConflictCode =
  | "ORG_ALREADY_BOUND"
  | "INSTALLATION_ALREADY_BOUND";

export class OrgSourceControlBindingConflictError extends Error {
  constructor(
    public readonly code: OrgSourceControlBindingConflictCode,
    message: string
  ) {
    super(message);
    this.name = "OrgSourceControlBindingConflictError";
  }
}

export interface GetOrgBindingByProviderInstallationInput {
  provider: OrgSourceControlBindingProvider;
  providerInstallationId: string;
}

/**
 * Returns the binding row associated with a provider installation id.
 */
export async function getOrgBindingByProviderInstallation(
  db: Database,
  input: GetOrgBindingByProviderInstallationInput
): Promise<OrgSourceControlBinding | undefined> {
  const [row] = await db
    .select(bindingSelection)
    .from(orgSourceControlBindings)
    .where(
      and(
        eq(orgSourceControlBindings.provider, input.provider),
        eq(
          orgSourceControlBindings.providerInstallationId,
          input.providerInstallationId
        )
      )
    )
    .limit(1);
  return row;
}

export interface UpsertActiveOrgBindingInput {
  clerkOrgId: string;
  /** Clerk user id that completed the bind. */
  connectedByUserId: string;
  metadata?: Record<string, unknown>;
  provider: OrgSourceControlBindingProvider;
  providerAccountId?: string | null;
  providerAccountLogin?: string | null;
  providerInstallationId?: string | null;
}

/**
 * Creates the org's active binding, or returns the existing one if the org is
 * already bound. Idempotent — safe to call repeatedly from the `bind` task.
 *
 * v1 does not mutate an existing active binding; re-auth and scope editing are
 * future Binding-management work.
 */
export async function upsertActiveOrgBinding(
  db: Database,
  input: UpsertActiveOrgBindingInput,
  options: { skipExistingCheck?: boolean } = {}
): Promise<OrgSourceControlBinding> {
  if (!options.skipExistingCheck) {
    const existing = await getActiveOrgBinding(db, input.clerkOrgId);
    if (existing) {
      return existing;
    }
  }

  return await insertActiveOrgBinding(db, input);
}

export interface FinalizeActiveOrgProviderBindingInput
  extends UpsertActiveOrgBindingInput {
  providerInstallationId: string;
}

/**
 * Finalizes a verified provider installation for a Lightfast org.
 *
 * Provider installation ids are unique across historical binding rows, so a
 * revoked/error row for the same org+installation is reactivated instead of
 * inserting a replacement row.
 */
export async function finalizeActiveOrgProviderBinding(
  db: Database,
  input: FinalizeActiveOrgProviderBindingInput
): Promise<OrgSourceControlBinding> {
  const activeBinding = await getActiveOrgBinding(db, input.clerkOrgId);
  if (activeBinding) {
    if (
      activeBinding.provider === input.provider &&
      activeBinding.providerInstallationId === input.providerInstallationId
    ) {
      return activeBinding;
    }

    throw new OrgSourceControlBindingConflictError(
      "ORG_ALREADY_BOUND",
      `Org ${input.clerkOrgId} is already bound to another provider installation`
    );
  }

  const installationBinding = await getOrgBindingByProviderInstallation(db, {
    provider: input.provider,
    providerInstallationId: input.providerInstallationId,
  });

  if (installationBinding) {
    if (installationBinding.clerkOrgId !== input.clerkOrgId) {
      throw new OrgSourceControlBindingConflictError(
        "INSTALLATION_ALREADY_BOUND",
        `Provider installation ${input.providerInstallationId} is already bound to another org`
      );
    }

    if (installationBinding.status === "active") {
      return installationBinding;
    }

    await db
      .update(orgSourceControlBindings)
      .set({
        activeClerkOrgId: input.clerkOrgId,
        connectedByUserId: input.connectedByUserId,
        providerAccountId:
          input.providerAccountId ?? installationBinding.providerAccountId,
        providerAccountLogin:
          input.providerAccountLogin ??
          installationBinding.providerAccountLogin,
        providerInstallationId: input.providerInstallationId,
        metadata: input.metadata ?? installationBinding.metadata,
        revokedAt: null,
        status: "active",
      })
      .where(
        and(
          eq(orgSourceControlBindings.id, installationBinding.id),
          eq(orgSourceControlBindings.clerkOrgId, input.clerkOrgId),
          eq(orgSourceControlBindings.provider, input.provider),
          eq(
            orgSourceControlBindings.providerInstallationId,
            input.providerInstallationId
          )
        )
      );

    const reactivated = await getActiveOrgBinding(db, input.clerkOrgId);
    if (!reactivated) {
      throw new Error(
        `Failed to reactivate provider binding for org ${input.clerkOrgId}`
      );
    }
    return reactivated;
  }

  return await insertFinalizedActiveOrgProviderBinding(db, input);
}

export interface MarkOrgBindingRevokedInput {
  clerkOrgId: string;
}

/**
 * Revokes every active binding for the org. Returns the rows transitioned to
 * `revoked` — empty when the org had no active binding.
 */
export async function markOrgBindingRevoked(
  db: Database,
  input: MarkOrgBindingRevokedInput
): Promise<OrgSourceControlBinding[]> {
  const activeRows = await db
    .select(bindingSelection)
    .from(orgSourceControlBindings)
    .where(
      and(
        eq(orgSourceControlBindings.clerkOrgId, input.clerkOrgId),
        eq(orgSourceControlBindings.status, "active")
      )
    );
  if (!activeRows.length) {
    return [];
  }

  const activeIds = activeRows.map((row) => row.id);
  await db
    .update(orgSourceControlBindings)
    .set({
      activeClerkOrgId: null,
      status: "revoked",
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(orgSourceControlBindings.clerkOrgId, input.clerkOrgId),
        inArray(orgSourceControlBindings.id, activeIds),
        eq(orgSourceControlBindings.status, "active")
      )
    );

  return await db
    .select(bindingSelection)
    .from(orgSourceControlBindings)
    .where(
      and(
        eq(orgSourceControlBindings.clerkOrgId, input.clerkOrgId),
        inArray(orgSourceControlBindings.id, activeIds),
        eq(orgSourceControlBindings.status, "revoked")
      )
    );
}

function isDuplicateKeyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const { body, code, message } = error as {
    body?: { code?: unknown };
    code?: unknown;
    message?: unknown;
  };

  return (
    body?.code === "ER_DUP_ENTRY" ||
    code === "ER_DUP_ENTRY" ||
    (typeof message === "string" && message.includes("Duplicate entry"))
  );
}

async function insertActiveOrgBinding(
  db: Database,
  input: UpsertActiveOrgBindingInput
): Promise<OrgSourceControlBinding> {
  let insertError: unknown;
  const [row] = await db
    .insert(orgSourceControlBindings)
    .values({
      activeClerkOrgId: input.clerkOrgId,
      clerkOrgId: input.clerkOrgId,
      provider: input.provider,
      connectedByUserId: input.connectedByUserId,
      providerAccountId: input.providerAccountId ?? null,
      providerAccountLogin: input.providerAccountLogin ?? null,
      providerInstallationId: input.providerInstallationId ?? null,
      metadata: input.metadata ?? {},
      status: "active",
    })
    .$returningId()
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      insertError = error;
      return [];
    });

  if (!(row?.id || insertError)) {
    throw new Error(
      `Failed to insert active binding for org ${input.clerkOrgId}`
    );
  }

  const inserted = await getActiveOrgBinding(db, input.clerkOrgId);
  if (!inserted) {
    if (insertError) {
      throw insertError;
    }
    throw new Error(
      `Failed to insert active binding for org ${input.clerkOrgId}`
    );
  }
  return inserted;
}

async function insertFinalizedActiveOrgProviderBinding(
  db: Database,
  input: FinalizeActiveOrgProviderBindingInput
): Promise<OrgSourceControlBinding> {
  let duplicateError: unknown;
  const [row] = await db
    .insert(orgSourceControlBindings)
    .values({
      activeClerkOrgId: input.clerkOrgId,
      clerkOrgId: input.clerkOrgId,
      provider: input.provider,
      connectedByUserId: input.connectedByUserId,
      providerAccountId: input.providerAccountId ?? null,
      providerAccountLogin: input.providerAccountLogin ?? null,
      providerInstallationId: input.providerInstallationId,
      metadata: input.metadata ?? {},
      status: "active",
    })
    .$returningId()
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
      return [];
    });

  if (duplicateError) {
    return await recoverFinalizedActiveOrgProviderBindingDuplicate(
      db,
      input,
      duplicateError
    );
  }

  if (!row?.id) {
    throw new Error(
      `Failed to insert active provider binding for org ${input.clerkOrgId}`
    );
  }

  const inserted = await getActiveOrgBinding(db, input.clerkOrgId);
  if (!inserted) {
    throw new Error(
      `Failed to insert active provider binding for org ${input.clerkOrgId}`
    );
  }
  if (isExactProviderBinding(inserted, input)) {
    return inserted;
  }
  throw new OrgSourceControlBindingConflictError(
    "ORG_ALREADY_BOUND",
    `Org ${input.clerkOrgId} is already bound to another provider installation`
  );
}

async function recoverFinalizedActiveOrgProviderBindingDuplicate(
  db: Database,
  input: FinalizeActiveOrgProviderBindingInput,
  duplicateError: unknown
): Promise<OrgSourceControlBinding> {
  const activeBinding = await getActiveOrgBinding(db, input.clerkOrgId);
  const installationBinding = await getOrgBindingByProviderInstallation(db, {
    provider: input.provider,
    providerInstallationId: input.providerInstallationId,
  });

  if (activeBinding && !isExactProviderBinding(activeBinding, input)) {
    throw new OrgSourceControlBindingConflictError(
      "ORG_ALREADY_BOUND",
      `Org ${input.clerkOrgId} is already bound to another provider installation`
    );
  }

  if (
    installationBinding &&
    installationBinding.clerkOrgId !== input.clerkOrgId
  ) {
    throw new OrgSourceControlBindingConflictError(
      "INSTALLATION_ALREADY_BOUND",
      `Provider installation ${input.providerInstallationId} is already bound to another org`
    );
  }

  if (activeBinding && isExactProviderBinding(activeBinding, input)) {
    return activeBinding;
  }

  if (
    installationBinding?.status === "active" &&
    isExactProviderBinding(installationBinding, input)
  ) {
    return installationBinding;
  }

  throw duplicateError;
}

function isExactProviderBinding(
  binding: OrgSourceControlBinding,
  input: FinalizeActiveOrgProviderBindingInput
): boolean {
  return (
    binding.clerkOrgId === input.clerkOrgId &&
    binding.provider === input.provider &&
    binding.providerInstallationId === input.providerInstallationId
  );
}
