import {
  skillNameSchema,
  skillValidationStatusSchema,
} from "@repo/skills-contract";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import {
  getSkillIndexSnapshot,
  getVerifiedLightfastSkillSourceRepositoryId,
  requestSkillIndexRefresh,
} from "../../services/skills";
import { boundOrgProcedure } from "../../trpc";

const listSkillsInput = z
  .object({
    validationStatus: skillValidationStatusSchema.optional(),
  })
  .strict()
  .optional();

export const workspaceSkillsRouter = {
  list: boundOrgProcedure
    .input(listSkillsInput)
    .query(async ({ ctx, input }) => {
      const sourceControlRepositoryId =
        await getVerifiedLightfastSkillSourceRepositoryId(ctx.db, {
          clerkOrgId: ctx.auth.identity.orgId,
        });
      const result = await getSkillIndexSnapshot({
        clerkOrgId: ctx.auth.identity.orgId,
        sourceControlRepositoryId,
      });

      return {
        ...result,
        skills: input?.validationStatus
          ? result.skills.filter(
              (skill) => skill.validationStatus === input.validationStatus
            )
          : result.skills,
      };
    }),
  get: boundOrgProcedure
    .input(z.object({ slug: skillNameSchema }).strict())
    .query(async ({ ctx, input }) => {
      const sourceControlRepositoryId =
        await getVerifiedLightfastSkillSourceRepositoryId(ctx.db, {
          clerkOrgId: ctx.auth.identity.orgId,
        });
      const result = await getSkillIndexSnapshot({
        clerkOrgId: ctx.auth.identity.orgId,
        slug: input.slug,
        sourceControlRepositoryId,
      });
      const skill = result.skills.find((item) => item.slug === input.slug);

      if (!skill) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Skill not found",
        });
      }

      return {
        freshness: result.freshness,
        indexDiagnostics: result.indexDiagnostics,
        repositoryUrl: result.repositoryUrl,
        skill,
      };
    }),
  requestRefresh: boundOrgProcedure
    .input(z.object({}).strict().optional())
    .mutation(async ({ ctx }) => {
      const sourceControlRepositoryId =
        await getVerifiedLightfastSkillSourceRepositoryId(ctx.db, {
          clerkOrgId: ctx.auth.identity.orgId,
        });
      const result = await requestSkillIndexRefresh({
        clerkOrgId: ctx.auth.identity.orgId,
        reason: "read",
        sourceControlRepositoryId,
      });

      return { enqueued: result.enqueued };
    }),
} satisfies TRPCRouterRecord;
