import {
  createSignalView as createSignalViewInDb,
  deleteSignalView as deleteSignalViewInDb,
  listSignalViews as listSignalViewsFromDb,
} from "@db/app";
import { db } from "@db/app/client";
import {
  signalDispositionSchema,
  signalKindSchema,
  signalPrioritySchema,
} from "@repo/api-contract";
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

const signalViewConfigSchema = z.object({
  filters: z.object({
    kinds: z.array(signalKindSchema).max(7),
    priorities: z.array(signalPrioritySchema).max(4),
    dispositions: z.array(signalDispositionSchema).max(3),
    peopleRouted: z.boolean(),
  }),
});

const createSignalViewInput = z.object({
  name: z.string().trim().min(1).max(120),
  config: signalViewConfigSchema,
});

const deleteSignalViewInput = z.object({
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

export const listSignalViews = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      const actor = await getBoundActor();
      return await listSignalViewsFromDb(db, {
        clerkOrgId: actor.orgId,
        createdByUserId: actor.userId,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const createSignalView = createServerFn({ method: "POST" })
  .inputValidator(createSignalViewInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      return await createSignalViewInDb(db, {
        clerkOrgId: actor.orgId,
        createdByUserId: actor.userId,
        name: data.name,
        config: data.config,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const deleteSignalView = createServerFn({ method: "POST" })
  .inputValidator(deleteSignalViewInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      const deleted = await deleteSignalViewInDb(db, {
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

export type ListSignalViewsResult = Awaited<ReturnType<typeof listSignalViews>>;
export type CreateSignalViewResult = Awaited<
  ReturnType<typeof createSignalView>
>;
