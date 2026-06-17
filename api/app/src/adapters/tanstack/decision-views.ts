import {
  createDecisionView as createDecisionViewInDb,
  deleteDecisionView as deleteDecisionViewInDb,
  listDecisionViews as listDecisionViewsFromDb,
  type ProviderRoutineCall,
} from "@db/app";
import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { resolveAuthContextFromClerk } from "../../auth/identity";
import {
  actorFromAuthIdentity,
  isDomainError,
  NotFoundError,
} from "../../domain";
import { requireBoundClerkOrgActor } from "../../domain/gates";

const DECISION_PROVIDERS = [
  "linear",
  "x",
] as const satisfies readonly ProviderRoutineCall["provider"][];
const DECISION_STATUSES = [
  "failed",
  "running",
  "succeeded",
] as const satisfies readonly ProviderRoutineCall["status"][];

const decisionViewConfigSchema = z.object({
  filters: z.object({
    providers: z
      .array(z.enum(DECISION_PROVIDERS))
      .max(DECISION_PROVIDERS.length),
    statuses: z.array(z.enum(DECISION_STATUSES)).max(DECISION_STATUSES.length),
  }),
});

const createDecisionViewInput = z.object({
  name: z.string().trim().min(1).max(120),
  config: decisionViewConfigSchema,
});

const deleteDecisionViewInput = z.object({
  publicId: z.string().min(1).max(64),
});

function requestId() {
  return crypto.randomUUID();
}

async function getBoundActor() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  return requireBoundClerkOrgActor({
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" },
  });
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
}

export const listDecisionViews = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      const actor = await getBoundActor();
      return await listDecisionViewsFromDb(db, {
        clerkOrgId: actor.orgId,
        createdByUserId: actor.userId,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const createDecisionView = createServerFn({ method: "POST" })
  .inputValidator(createDecisionViewInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      return await createDecisionViewInDb(db, {
        clerkOrgId: actor.orgId,
        createdByUserId: actor.userId,
        name: data.name,
        config: data.config,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const deleteDecisionView = createServerFn({ method: "POST" })
  .inputValidator(deleteDecisionViewInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      const deleted = await deleteDecisionViewInDb(db, {
        clerkOrgId: actor.orgId,
        createdByUserId: actor.userId,
        publicId: data.publicId,
      });
      if (!deleted) {
        throw new NotFoundError("VIEW_NOT_FOUND", "View not found");
      }
      return { success: true };
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListDecisionViewsResult = Awaited<
  ReturnType<typeof listDecisionViews>
>;
export type CreateDecisionViewResult = Awaited<
  ReturnType<typeof createDecisionView>
>;
