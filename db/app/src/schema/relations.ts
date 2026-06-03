// Relations between tables for Drizzle ORM queries.
//
import { relations } from "drizzle-orm";

import {
  orgIdentityIndexFiles,
  orgIdentityIndexStates,
  orgSkillIndexEntries,
  orgSkillIndexStates,
  orgSourceControlRepositories,
} from "./tables";

export const sourceControlRepositoriesRelations = relations(
  orgSourceControlRepositories,
  ({ one }) => ({
    identityIndexState: one(orgIdentityIndexStates, {
      fields: [orgSourceControlRepositories.id],
      references: [orgIdentityIndexStates.sourceControlRepositoryId],
    }),
    skillIndexState: one(orgSkillIndexStates, {
      fields: [orgSourceControlRepositories.id],
      references: [orgSkillIndexStates.sourceControlRepositoryId],
    }),
  })
);

export const identityIndexStatesRelations = relations(
  orgIdentityIndexStates,
  ({ many, one }) => ({
    files: many(orgIdentityIndexFiles),
    sourceControlRepository: one(orgSourceControlRepositories, {
      fields: [orgIdentityIndexStates.sourceControlRepositoryId],
      references: [orgSourceControlRepositories.id],
    }),
  })
);

export const identityIndexFilesRelations = relations(
  orgIdentityIndexFiles,
  ({ one }) => ({
    state: one(orgIdentityIndexStates, {
      fields: [orgIdentityIndexFiles.identityIndexStateId],
      references: [orgIdentityIndexStates.id],
    }),
  })
);

export const skillIndexStatesRelations = relations(
  orgSkillIndexStates,
  ({ many, one }) => ({
    entries: many(orgSkillIndexEntries),
    sourceControlRepository: one(orgSourceControlRepositories, {
      fields: [orgSkillIndexStates.sourceControlRepositoryId],
      references: [orgSourceControlRepositories.id],
    }),
  })
);

export const skillIndexEntriesRelations = relations(
  orgSkillIndexEntries,
  ({ one }) => ({
    state: one(orgSkillIndexStates, {
      fields: [orgSkillIndexEntries.skillIndexStateId],
      references: [orgSkillIndexStates.id],
    }),
  })
);
