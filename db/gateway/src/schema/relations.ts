import { relations } from "drizzle-orm";
import { installations, tokens, resources } from "./tables";

export const installationsRelations = relations(installations, ({ many }) => ({
  tokens: many(tokens),
  resources: many(resources),
}));

export const tokensRelations = relations(tokens, ({ one }) => ({
  installation: one(installations, {
    fields: [tokens.installationId],
    references: [installations.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  installation: one(installations, {
    fields: [resources.installationId],
    references: [installations.id],
  }),
}));
