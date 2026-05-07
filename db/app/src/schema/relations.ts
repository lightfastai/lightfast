import { relations } from "drizzle-orm";
import { gatewayInstallations } from "./tables/gateway-installations";
import { gatewayLifecycleLogs } from "./tables/gateway-lifecycle-log";
import { gatewayTokens } from "./tables/gateway-tokens";
import { orgIntegrations } from "./tables/org-integrations";

/**
 * Define relations between tables for Drizzle ORM queries
 *
 * Note: Organizations are managed by Clerk, not in our database.
 * Tables reference Clerk org IDs via clerkOrgId fields (no FK constraints).
 */

// Gateway relations
export const gatewayInstallationsRelations = relations(
  gatewayInstallations,
  ({ many }) => ({
    tokens: many(gatewayTokens),
    orgIntegrations: many(orgIntegrations),
    lifecycleLogs: many(gatewayLifecycleLogs),
  })
);

export const gatewayLifecycleLogsRelations = relations(
  gatewayLifecycleLogs,
  ({ one }) => ({
    installation: one(gatewayInstallations, {
      fields: [gatewayLifecycleLogs.installationId],
      references: [gatewayInstallations.id],
    }),
  })
);

export const gatewayTokensRelations = relations(gatewayTokens, ({ one }) => ({
  installation: one(gatewayInstallations, {
    fields: [gatewayTokens.installationId],
    references: [gatewayInstallations.id],
  }),
}));

export const orgIntegrationsRelations = relations(
  orgIntegrations,
  ({ one }) => ({
    installation: one(gatewayInstallations, {
      fields: [orgIntegrations.installationId],
      references: [gatewayInstallations.id],
    }),
  })
);
