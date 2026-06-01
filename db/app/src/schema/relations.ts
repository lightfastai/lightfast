// Relations between tables for Drizzle ORM queries.
//
import { relations } from "drizzle-orm";

import {
  skillIndexEntries,
  skillIndexStates,
  sourceControlRepositories,
} from "./tables";

export const sourceControlRepositoriesRelations = relations(
  sourceControlRepositories,
  ({ one }) => ({
    skillIndexState: one(skillIndexStates, {
      fields: [sourceControlRepositories.id],
      references: [skillIndexStates.sourceControlRepositoryId],
    }),
  })
);

export const skillIndexStatesRelations = relations(
  skillIndexStates,
  ({ many, one }) => ({
    entries: many(skillIndexEntries),
    sourceControlRepository: one(sourceControlRepositories, {
      fields: [skillIndexStates.sourceControlRepositoryId],
      references: [sourceControlRepositories.id],
    }),
  })
);

export const skillIndexEntriesRelations = relations(
  skillIndexEntries,
  ({ one }) => ({
    state: one(skillIndexStates, {
      fields: [skillIndexEntries.skillIndexStateId],
      references: [skillIndexStates.id],
    }),
  })
);
