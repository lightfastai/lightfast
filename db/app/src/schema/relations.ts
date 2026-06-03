// Relations between tables for Drizzle ORM queries.
//
import { relations } from "drizzle-orm";

import {
  identityIndexFiles,
  identityIndexStates,
  skillIndexEntries,
  skillIndexStates,
  sourceControlRepositories,
} from "./tables";

export const sourceControlRepositoriesRelations = relations(
  sourceControlRepositories,
  ({ one }) => ({
    identityIndexState: one(identityIndexStates, {
      fields: [sourceControlRepositories.id],
      references: [identityIndexStates.sourceControlRepositoryId],
    }),
    skillIndexState: one(skillIndexStates, {
      fields: [sourceControlRepositories.id],
      references: [skillIndexStates.sourceControlRepositoryId],
    }),
  })
);

export const identityIndexStatesRelations = relations(
  identityIndexStates,
  ({ many, one }) => ({
    files: many(identityIndexFiles),
    sourceControlRepository: one(sourceControlRepositories, {
      fields: [identityIndexStates.sourceControlRepositoryId],
      references: [sourceControlRepositories.id],
    }),
  })
);

export const identityIndexFilesRelations = relations(
  identityIndexFiles,
  ({ one }) => ({
    state: one(identityIndexStates, {
      fields: [identityIndexFiles.identityIndexStateId],
      references: [identityIndexStates.id],
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
