import { TRPCError } from "@trpc/server";
import z from "zod";

import { eq } from "@vendor/db";
import { User, Workspace } from "@vendor/db/lightfast/schema";

import { protectedProcedure } from "../../trpc";

export const verifyWorkspaceOwnership = protectedProcedure
  .input(z.object({ workspaceId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    // Get the user's internal ID
    const [user] = await ctx.db
      .select()
      .from(User)
      .where(eq(User.clerkId, ctx.session.user.clerkId))
      .limit(1);

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Verify workspace ownership
    const [workspace] = await ctx.db
      .select()
      .from(Workspace)
      .where(eq(Workspace.id, input.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You do not have access to this workspace",
      });
    }

    return next({
      ctx: {
        // Add the verified workspace and user to the context
        workspace,
        user,
      },
    });
  });
