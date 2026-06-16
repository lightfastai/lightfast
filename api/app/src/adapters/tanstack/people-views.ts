import {
  createPeopleView as createPeopleViewInDb,
  deletePeopleView as deletePeopleViewInDb,
  listPeopleViews as listPeopleViewsFromDb,
} from "@db/app";
import { db } from "@db/app/client";
import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
  personMemberStatusSchema,
  personSourceSchema,
} from "@repo/app-validation/schemas";
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

const peopleViewConfigSchema = z.object({
  filters: z.object({
    providers: z.array(peopleIdentityProviderSchema).max(5),
    sources: z.array(personSourceSchema).max(3).default([]),
    memberStatuses: z.array(personMemberStatusSchema).max(2).default([]),
    types: z.array(peopleIdentityTypeSchema).max(3),
  }),
});

const createPeopleViewInput = z.object({
  name: z.string().trim().min(1).max(120),
  config: peopleViewConfigSchema,
});

const deletePeopleViewInput = z.object({
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

export const listPeopleViews = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      const actor = await getBoundActor();
      return await listPeopleViewsFromDb(db, {
        clerkOrgId: actor.orgId,
        createdByUserId: actor.userId,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const createPeopleView = createServerFn({ method: "POST" })
  .inputValidator(createPeopleViewInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      return await createPeopleViewInDb(db, {
        clerkOrgId: actor.orgId,
        createdByUserId: actor.userId,
        name: data.name,
        config: data.config,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const deletePeopleView = createServerFn({ method: "POST" })
  .inputValidator(deletePeopleViewInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      const deleted = await deletePeopleViewInDb(db, {
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

export type ListPeopleViewsResult = Awaited<ReturnType<typeof listPeopleViews>>;
export type CreatePeopleViewResult = Awaited<
  ReturnType<typeof createPeopleView>
>;
