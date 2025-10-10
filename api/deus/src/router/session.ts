import type { TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  DEUS_AGENT_TYPES,
  DEUS_SESSION_STATUS,
  DeusMessage,
  DeusSession,
  organizations,
} from "@db/deus/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { LightfastAppDeusUIMessage } from "@repo/deus-types";

import {
  apiKeyProtectedProcedure,
  clerkProtectedProcedure,
} from "../trpc";

/**
 * Helper function to calculate character count from message parts
 */
function calculateCharCount(parts: LightfastAppDeusUIMessage["parts"]): number {
  return parts.reduce((total, part) => {
    if (part.type === "text") {
      return total + part.text.length;
    }
    return total;
  }, 0);
}

/**
 * Session router for Deus CLI session management
 *
 * API KEY PROTECTED PROCEDURES (CLI with API key auth):
 * - create: Create new session
 * - update: Update session status/metadata
 * - addMessage: Add message to session
 *
 * CLERK PROTECTED PROCEDURES (Clerk auth for web UI):
 * - list: List sessions for organization
 * - get: Get session by ID
 * - getMessages: Get messages for session
 */
export const sessionRouter = {
  /**
   * Create a new session (API KEY PROTECTED - used by CLI)
   *
   * Requires API key authentication via Authorization header: 'Bearer deus_sk_...'
   */
  create: apiKeyProtectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        organizationId: z.string(), // Accepts Clerk org ID (org_xxx)
        repositoryId: z.string().optional(),
        cwd: z.string(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Look up internal org ID from Clerk org ID
      const orgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.clerkOrgId, input.organizationId),
      });

      if (!orgResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Organization not found: ${input.organizationId}`,
        });
      }

      // Create session with internal org ID
      // userId comes from auth context (API key)
      await ctx.db.insert(DeusSession).values({
        id: input.id,
        organizationId: orgResult.id, // Use internal org ID
        repositoryId: input.repositoryId,
        userId: ctx.auth.userId,  // Get from auth context
        cwd: input.cwd,
        metadata: input.metadata,
        status: "active",
      });

      // Fetch and return the created session
      const createdResult = await ctx.db
        .select()
        .from(DeusSession)
        .where(eq(DeusSession.id, input.id))
        .limit(1);

      const session = createdResult[0];

      if (!session) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create session",
        });
      }

      return session;
    }),

  /**
   * Update session status and metadata (API KEY PROTECTED - used by CLI)
   *
   * Requires API key authentication via Authorization header: 'Bearer deus_sk_...'
   */
  update: apiKeyProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(DEUS_SESSION_STATUS).optional(),
        currentAgent: z.enum(DEUS_AGENT_TYPES).nullable().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Build update object with only provided fields
      const updates: {
        status?: (typeof DEUS_SESSION_STATUS)[number];
        currentAgent?: (typeof DEUS_AGENT_TYPES)[number] | null;
        metadata?: Record<string, unknown>;
      } = {};

      if (input.status !== undefined) {
        updates.status = input.status;
      }

      if (input.currentAgent !== undefined) {
        updates.currentAgent = input.currentAgent;
      }

      if (input.metadata !== undefined) {
        updates.metadata = input.metadata;
      }

      // Update the session
      await ctx.db
        .update(DeusSession)
        .set(updates)
        .where(eq(DeusSession.id, input.id));

      // Fetch and return the updated session
      const updatedResult = await ctx.db
        .select()
        .from(DeusSession)
        .where(eq(DeusSession.id, input.id))
        .limit(1);

      const session = updatedResult[0];

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      return session;
    }),

  /**
   * Add a message to a session (API KEY PROTECTED - used by CLI)
   *
   * Requires API key authentication via Authorization header: 'Bearer deus_sk_...'
   */
  addMessage: apiKeyProtectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        role: z.enum(["system", "user", "assistant"]),
        parts: z.array(z.any()), // Type is validated by DB schema
        modelId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session exists
      const sessionResult = await ctx.db
        .select({ id: DeusSession.id })
        .from(DeusSession)
        .where(eq(DeusSession.id, input.sessionId))
        .limit(1);

      if (!sessionResult[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Calculate character count from parts
      const charCount = calculateCharCount(
        input.parts as LightfastAppDeusUIMessage["parts"],
      );

      // Generate message ID
      const messageId = crypto.randomUUID();

      // Create message
      await ctx.db.insert(DeusMessage).values({
        id: messageId,
        sessionId: input.sessionId,
        role: input.role,
        parts: input.parts,
        charCount,
        modelId: input.modelId,
      });

      // Fetch and return the created message
      const createdResult = await ctx.db
        .select()
        .from(DeusMessage)
        .where(eq(DeusMessage.id, messageId))
        .limit(1);

      const message = createdResult[0];

      if (!message) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create message",
        });
      }

      return message;
    }),

  /**
   * List sessions for an organization (PROTECTED - web UI)
   *
   * Returns sessions in reverse chronological order with cursor pagination.
   */
  list: clerkProtectedProcedure
    .input(
      z.object({
        organizationId: z.string(), // Accepts Clerk org ID (org_xxx)
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(), // Cursor is createdAt timestamp
        status: z.enum(DEUS_SESSION_STATUS).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Look up internal org ID from Clerk org ID
      const deusOrgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.clerkOrgId, input.organizationId),
      });

      if (!deusOrgResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Organization not found: ${input.organizationId}`,
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: input.organizationId, // Use Clerk org ID directly
          limit: 500,
        });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // Build where conditions using internal org ID
      const whereConditions = [
        eq(DeusSession.organizationId, deusOrgResult.id),
      ];

      if (input.status) {
        whereConditions.push(eq(DeusSession.status, input.status));
      }

      // Add cursor condition if provided (createdAt < cursor)
      // Note: We can't use lt() directly with datetime strings in a type-safe way,
      // so we'll filter in application code instead
      const sessions = await ctx.db
        .select()
        .from(DeusSession)
        .where(and(...whereConditions))
        .orderBy(desc(DeusSession.createdAt))
        .limit(input.limit + 1); // Fetch one extra to determine if there's a next page

      // Filter by cursor in application code
      let filteredSessions = sessions;
      if (input.cursor) {
        const cursor = input.cursor;
        filteredSessions = sessions.filter((s) => s.createdAt < cursor);
      }

      // Take only the requested limit
      const hasMore = filteredSessions.length > input.limit;
      const resultSessions = hasMore
        ? filteredSessions.slice(0, input.limit)
        : filteredSessions;

      // Next cursor is the createdAt of the last session
      const nextCursor =
        hasMore && resultSessions.length > 0
          ? resultSessions[resultSessions.length - 1]?.createdAt
          : undefined;

      // Debug logging
      console.log(`[session.list] Returning ${resultSessions.length} sessions for org ${input.organizationId}`);

      return {
        sessions: resultSessions,
        nextCursor,
      };
    }),

  /**
   * Get a single session by ID (PROTECTED - web UI)
   *
   * Returns session metadata without messages.
   * Use getMessages to fetch messages separately.
   */
  get: clerkProtectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Fetch the session
      const sessionResult = await ctx.db
        .select()
        .from(DeusSession)
        .where(eq(DeusSession.id, input.id))
        .limit(1);

      const session = sessionResult[0];

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Verify user has access to the organization
      const deusOrgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, session.organizationId),
      });

      if (!deusOrgResult?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: deusOrgResult.clerkOrgId,
          limit: 500,
        });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this session",
        });
      }

      return session;
    }),

  /**
   * Get messages for a session (PROTECTED - web UI)
   *
   * Returns messages in chronological order (oldest first) with cursor pagination.
   */
  getMessages: clerkProtectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(), // Cursor is createdAt timestamp
      }),
    )
    .query(async ({ ctx, input }) => {
      // Fetch the session to verify access
      const sessionResult = await ctx.db
        .select()
        .from(DeusSession)
        .where(eq(DeusSession.id, input.sessionId))
        .limit(1);

      const session = sessionResult[0];

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Verify user has access to the organization
      const deusOrgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, session.organizationId),
      });

      if (!deusOrgResult?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: deusOrgResult.clerkOrgId,
          limit: 500,
        });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this session",
        });
      }

      // Fetch messages
      // Note: Messages are ordered chronologically (ASC) for timeline display
      const messages = await ctx.db
        .select()
        .from(DeusMessage)
        .where(eq(DeusMessage.sessionId, input.sessionId))
        .orderBy(desc(DeusMessage.createdAt)) // Use DESC to get latest first
        .limit(input.limit + 1); // Fetch one extra to determine if there's more

      // Filter by cursor in application code (createdAt < cursor for DESC order)
      let filteredMessages = messages;
      if (input.cursor) {
        const cursor = input.cursor;
        filteredMessages = messages.filter((m) => m.createdAt < cursor);
      }

      // Take only the requested limit
      const hasMore = filteredMessages.length > input.limit;
      const resultMessages = hasMore
        ? filteredMessages.slice(0, input.limit)
        : filteredMessages;

      // Next cursor is the createdAt of the last message
      const nextCursor =
        hasMore && resultMessages.length > 0
          ? resultMessages[resultMessages.length - 1]?.createdAt
          : undefined;

      return {
        messages: resultMessages,
        nextCursor,
      };
    }),
} satisfies TRPCRouterRecord;
