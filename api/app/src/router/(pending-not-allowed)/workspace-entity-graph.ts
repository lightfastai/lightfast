import {
  getEntityAccountByPublicId,
  getEntityAccountEvidenceTrail,
  getEntityPersonByPublicId,
  getEntityPersonEvidenceTrail,
  listEntityAccounts,
  listEntityPeople,
  listEntityPersonAccountAffiliations,
} from "@db/app";
import { entityGraphStatusSchema } from "@repo/entity-graph-contract";
import { SIMULATED_ENTITY_SCENARIOS } from "@repo/entity-resolution";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure, createTRPCRouter } from "../../trpc";
import { workspaceListLimitInput } from "./workspace-list-input";

const listEntitiesInput = z
  .object({
    limit: workspaceListLimitInput,
    status: entityGraphStatusSchema.optional(),
  })
  .strict();

const publicIdInput = z
  .object({
    publicId: z.string().trim().min(1),
  })
  .strict();

export const workspaceEntityGraphRouter = createTRPCRouter({
  people: createTRPCRouter({
    list: boundOrgProcedure.input(listEntitiesInput).query(({ ctx, input }) =>
      listEntityPeople(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        limit: input.limit,
        status: input.status,
      })
    ),
    get: boundOrgProcedure
      .input(publicIdInput)
      .query(async ({ ctx, input }) => {
        const person = await getEntityPersonByPublicId(ctx.db, {
          clerkOrgId: ctx.auth.identity.orgId,
          publicId: input.publicId,
        });

        if (!person) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entity person not found",
          });
        }

        const [affiliations, evidenceTrail] = await Promise.all([
          listEntityPersonAccountAffiliations(ctx.db, {
            clerkOrgId: ctx.auth.identity.orgId,
            limit: 100,
            personId: person.id,
          }),
          getEntityPersonEvidenceTrail(ctx.db, {
            canonicalKey: person.canonicalKey,
            clerkOrgId: ctx.auth.identity.orgId,
          }),
        ]);

        return {
          affiliations,
          evidenceTrail,
          person,
        };
      }),
  }),
  accounts: createTRPCRouter({
    list: boundOrgProcedure.input(listEntitiesInput).query(({ ctx, input }) =>
      listEntityAccounts(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        limit: input.limit,
        status: input.status,
      })
    ),
    get: boundOrgProcedure
      .input(publicIdInput)
      .query(async ({ ctx, input }) => {
        const account = await getEntityAccountByPublicId(ctx.db, {
          clerkOrgId: ctx.auth.identity.orgId,
          publicId: input.publicId,
        });

        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entity account not found",
          });
        }

        const evidenceTrail = await getEntityAccountEvidenceTrail(ctx.db, {
          canonicalKey: account.canonicalKey,
          clerkOrgId: ctx.auth.identity.orgId,
        });

        return {
          account,
          evidenceTrail,
        };
      }),
  }),
  dev: createTRPCRouter({
    ingestSimulated: boundOrgProcedure.mutation(async ({ ctx }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Simulated entity graph ingestion is dev-only",
        });
      }

      const observations = SIMULATED_ENTITY_SCENARIOS.flatMap(
        (scenario) => scenario.observations
      );
      const ingestionId = `simulated-${Date.now()}`;
      const resolverVersion = "local-simulated-v1";
      const { inngest } = await import("../../inngest/client");

      await inngest.send({
        id: `entity-graph-simulated-${ctx.auth.identity.orgId}-${ingestionId}`,
        name: "app/connector.profile.observed",
        data: {
          clerkOrgId: ctx.auth.identity.orgId,
          ingestionId,
          observations,
          resolverVersion,
        },
      });

      return {
        ingestionId,
        observations: observations.length,
        status: "queued" as const,
      };
    }),
  }),
});
