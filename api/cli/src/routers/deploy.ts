import type { TRPCRouterRecord } from "@trpc/server";
import { CloudAgent } from "@db/cloud/schema";
import { and, eq } from "drizzle-orm";
import { put } from "@vendor/storage";
import { z } from "zod";

import { uuidv4 } from "@repo/lib";

import {
  apiKeyProtectedProcedure,
  TRPCError,
} from "../trpc";

export const deployRouter = {
  /**
   * Create a new agent - uploads bundle and creates agent registry entry
   */
  create: apiKeyProtectedProcedure
    .input(
      z.object({
        apiKey: z.string(),
        name: z
          .string()
          .min(1, "Name is required")
          .max(100, "Name must be less than 100 characters"),
        bundleContent: z.string().min(1, "Bundle content is required"),
        filename: z.string().min(1, "Filename is required"),
        contentType: z.string().default("application/javascript"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, auth } = ctx;
      const { name, bundleContent, filename, contentType } = input;

      try {
        // Check if agent already exists
        const [existingAgent] = await db
          .select({ id: CloudAgent.id })
          .from(CloudAgent)
          .where(
            and(
              eq(CloudAgent.clerkOrgId, auth.organizationId),
              eq(CloudAgent.name, name),
            ),
          )
          .limit(1);

        if (existingAgent) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Agent "${name}" already exists. Use update endpoint to modify it.`,
          });
        }

        // Upload bundle to Vercel Blob storage
        const orgPrefix = auth.organizationId.slice(0, 8);
        const timestamp = Date.now();
        const blobPath = `agents/${orgPrefix}/${name}/${timestamp}.js`;
        const buffer = Buffer.from(bundleContent, 'utf-8');

        const blob = await put(blobPath, buffer, {
          contentType,
          access: 'public',
        });

        // Create new agent
        const agentId = uuidv4();
        await db.insert(CloudAgent).values({
          id: agentId,
          clerkOrgId: auth.organizationId,
          name,
          bundleUrl: blob.url,
          authorUserId: auth.userId,
        });

        const [newAgent] = await db
          .select()
          .from(CloudAgent)
          .where(eq(CloudAgent.id, agentId))
          .limit(1);

        if (!newAgent) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create agent",
          });
        }

        return {
          success: true,
          agent: newAgent,
          upload: {
            url: blob.url,
            path: blobPath,
            size: buffer.length,
          },
          message: `Agent "${name}" created successfully`,
        };
      } catch (error) {
        console.error('Create agent error:', error);
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Agent creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Update an existing agent - uploads new bundle and updates registry entry
   */
  update: apiKeyProtectedProcedure
    .input(
      z.object({
        apiKey: z.string(),
        name: z.string().min(1, "Agent name is required"),
        bundleContent: z.string().min(1, "Bundle content is required"),
        filename: z.string().min(1, "Filename is required"),
        contentType: z.string().default("application/javascript"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, auth } = ctx;
      const { name, bundleContent, filename, contentType } = input;

      try {
        // Check if agent exists
        const [existingAgent] = await db
          .select({ id: CloudAgent.id })
          .from(CloudAgent)
          .where(
            and(
              eq(CloudAgent.clerkOrgId, auth.organizationId),
              eq(CloudAgent.name, name),
            ),
          )
          .limit(1);

        if (!existingAgent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Agent "${name}" not found. Use create endpoint to create it.`,
          });
        }

        // Upload new bundle to Vercel Blob storage
        const orgPrefix = auth.organizationId.slice(0, 8);
        const timestamp = Date.now();
        const blobPath = `agents/${orgPrefix}/${name}/${timestamp}.js`;
        const buffer = Buffer.from(bundleContent, 'utf-8');

        const blob = await put(blobPath, buffer, {
          contentType,
          access: 'public',
        });

        // Update existing agent
        await db
          .update(CloudAgent)
          .set({
            bundleUrl: blob.url,
            authorUserId: auth.userId,
          })
          .where(eq(CloudAgent.id, existingAgent.id));

        const [updatedAgent] = await db
          .select()
          .from(CloudAgent)
          .where(eq(CloudAgent.id, existingAgent.id))
          .limit(1);

        if (!updatedAgent) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update agent",
          });
        }

        return {
          success: true,
          agent: updatedAgent,
          upload: {
            url: blob.url,
            path: blobPath,
            size: buffer.length,
          },
          message: `Agent "${name}" updated successfully`,
        };
      } catch (error) {
        console.error('Update agent error:', error);
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Agent update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

} satisfies TRPCRouterRecord;