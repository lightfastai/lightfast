/**
 * Organization management router for Lightfast Cloud
 *
 * Provides endpoints for managing organization settings, members, and configuration
 * in the multi-tenant Lightfast Cloud platform.
 */

import { CloudOrgSettings } from "@db/cloud/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, orgAdminProcedure, orgProtectedProcedure } from "../trpc";

export const organizationRouter = createTRPCRouter({
  /**
   * Get current organization settings
   * Accessible to all organization members
   */
  getSettings: orgProtectedProcedure
    .query(async ({ ctx }) => {
      const { db, organization } = ctx;

      const settings = await db
        .select()
        .from(CloudOrgSettings)
        .where(eq(CloudOrgSettings.clerkOrgId, organization.id))
        .limit(1);

      return settings[0] || null;
    }),

  /**
   * Create organization settings (auto-created on first access)
   * Accessible to organization admins
   */
  createSettings: orgAdminProcedure
    .input(z.object({
      displayName: z.string().min(1).max(100).optional(),
      slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, organization } = ctx;

      // Check if settings already exist
      const existingSettings = await db
        .select()
        .from(CloudOrgSettings)
        .where(eq(CloudOrgSettings.clerkOrgId, organization.id))
        .limit(1);

      if (existingSettings.length > 0) {
        throw new Error("Organization settings already exist");
      }

      // Create new settings
      const insertResult = await db
        .insert(CloudOrgSettings)
        .values({
          clerkOrgId: organization.id,
          displayName: input.displayName,
          slug: input.slug,
          planType: 'free', // Default plan
        });

      // Fetch the created settings
      const newSettings = await db
        .select()
        .from(CloudOrgSettings)
        .where(eq(CloudOrgSettings.clerkOrgId, organization.id))
        .limit(1);

      return newSettings[0];
    }),

  /**
   * Update organization settings
   * Accessible to organization admins
   */
  updateSettings: orgAdminProcedure
    .input(z.object({
      displayName: z.string().min(1).max(100).optional(),
      slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
      planType: z.enum(['free', 'pro', 'enterprise']).optional(),
      apiKeyLimit: z.number().int().min(1).max(1000).optional(),
      deploymentLimit: z.number().int().min(1).max(10000).optional(),
      monthlyExecutionLimit: z.number().int().min(1000).optional(),
      settings: z.object({
        features: z.object({
          advancedAnalytics: z.boolean().optional(),
          customDomains: z.boolean().optional(),
          ssoEnabled: z.boolean().optional(),
        }).optional(),
        limits: z.object({
          maxAgentsPerDeployment: z.number().int().min(1).optional(),
          maxParallelExecutions: z.number().int().min(1).optional(),
        }).optional(),
        billing: z.object({
          stripeCustomerId: z.string().optional(),
          subscriptionId: z.string().optional(),
        }).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, organization } = ctx;

      const updateResult = await db
        .update(CloudOrgSettings)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(CloudOrgSettings.clerkOrgId, organization.id));

      // Fetch the updated settings
      const updatedSettings = await db
        .select()
        .from(CloudOrgSettings)
        .where(eq(CloudOrgSettings.clerkOrgId, organization.id))
        .limit(1);

      if (updatedSettings.length === 0) {
        throw new Error("Organization settings not found");
      }

      return updatedSettings[0];
    }),

  /**
   * Get organization usage statistics
   * Accessible to all organization members
   */
  getUsage: orgProtectedProcedure
    .query(async ({ ctx }) => {
      const { db, organization } = ctx;

      // Get current settings for limits
      const settings = await db
        .select()
        .from(CloudOrgSettings)
        .where(eq(CloudOrgSettings.clerkOrgId, organization.id))
        .limit(1);

      const orgSettings = settings[0];
      if (!orgSettings) {
        return {
          apiKeysUsed: 0,
          apiKeysLimit: 10,
          deploymentsUsed: 0,
          deploymentsLimit: 100,
          monthlyExecutionsUsed: 0,
          monthlyExecutionsLimit: 1000000,
        };
      }

      // TODO: Implement actual usage counting
      // This would require counting API keys and deployments from their respective tables
      // For now, return placeholder values
      return {
        apiKeysUsed: 0,
        apiKeysLimit: orgSettings.apiKeyLimit,
        deploymentsUsed: 0,
        deploymentsLimit: orgSettings.deploymentLimit,
        monthlyExecutionsUsed: 0,
        monthlyExecutionsLimit: orgSettings.monthlyExecutionLimit,
      };
    }),

  /**
   * Get organization context information
   * Returns the organization ID, role, and permissions for the current user
   */
  getContext: orgProtectedProcedure
    .query(({ ctx }) => {
      return {
        organizationId: ctx.organization.id,
        role: ctx.organization.role,
        permissions: ctx.organization.permissions || [],
        userId: ctx.session.data.userId,
      };
    }),

  /**
   * Check if user has specific permission in organization
   * Accessible to all organization members
   */
  hasPermission: orgProtectedProcedure
    .input(z.object({
      permission: z.string(),
    }))
    .query(({ ctx, input }) => {
      const { organization } = ctx;
      
      // Admin role has all permissions
      if (['admin', 'org:admin'].includes(organization.role)) {
        return true;
      }

      // Check specific permission
      return organization.permissions?.includes(input.permission) || false;
    }),
});