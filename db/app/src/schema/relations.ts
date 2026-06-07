// Relations between tables for Drizzle ORM queries.
//
import { relations } from "drizzle-orm";

import {
  orgEntityAccounts,
  orgEntityEvidenceItems,
  orgEntityLinks,
  orgEntityObservations,
  orgEntityPeople,
  orgEntityPersonAccountAffiliations,
  orgEntityResolutionCandidateGroups,
  orgEntityResolutionCandidateVersions,
  orgEntitySourceIdentities,
  orgIdentityIndexFiles,
  orgIdentityIndexStates,
  orgSkillIndexEntries,
  orgSkillIndexStates,
  orgSourceControlRepositories,
} from "./tables";

export const orgEntityPeopleRelations = relations(
  orgEntityPeople,
  ({ many, one }) => ({
    affiliations: many(orgEntityPersonAccountAffiliations),
    primarySourceIdentity: one(orgEntitySourceIdentities, {
      fields: [orgEntityPeople.primarySourceIdentityId],
      references: [orgEntitySourceIdentities.id],
    }),
  })
);

export const orgEntityAccountsRelations = relations(
  orgEntityAccounts,
  ({ many }) => ({
    affiliations: many(orgEntityPersonAccountAffiliations),
  })
);

export const orgEntityPersonAccountAffiliationsRelations = relations(
  orgEntityPersonAccountAffiliations,
  ({ one }) => ({
    account: one(orgEntityAccounts, {
      fields: [orgEntityPersonAccountAffiliations.accountId],
      references: [orgEntityAccounts.id],
    }),
    person: one(orgEntityPeople, {
      fields: [orgEntityPersonAccountAffiliations.personId],
      references: [orgEntityPeople.id],
    }),
  })
);

export const orgEntitySourceIdentitiesRelations = relations(
  orgEntitySourceIdentities,
  ({ many }) => ({
    entityLinks: many(orgEntityLinks),
    observations: many(orgEntityObservations),
  })
);

export const orgEntityObservationsRelations = relations(
  orgEntityObservations,
  ({ many, one }) => ({
    evidenceItems: many(orgEntityEvidenceItems),
    sourceIdentity: one(orgEntitySourceIdentities, {
      fields: [orgEntityObservations.sourceIdentityId],
      references: [orgEntitySourceIdentities.id],
    }),
  })
);

export const orgEntityEvidenceItemsRelations = relations(
  orgEntityEvidenceItems,
  ({ one }) => ({
    sourceObservation: one(orgEntityObservations, {
      fields: [orgEntityEvidenceItems.sourceObservationId],
      references: [orgEntityObservations.id],
    }),
  })
);

export const orgEntityLinksRelations = relations(orgEntityLinks, ({ one }) => ({
  sourceIdentity: one(orgEntitySourceIdentities, {
    fields: [orgEntityLinks.sourceIdentityId],
    references: [orgEntitySourceIdentities.id],
  }),
}));

export const orgEntityResolutionCandidateGroupsRelations = relations(
  orgEntityResolutionCandidateGroups,
  ({ many, one }) => ({
    currentCandidateVersion: one(orgEntityResolutionCandidateVersions, {
      fields: [orgEntityResolutionCandidateGroups.currentCandidateVersionId],
      references: [orgEntityResolutionCandidateVersions.id],
    }),
    versions: many(orgEntityResolutionCandidateVersions),
  })
);

export const orgEntityResolutionCandidateVersionsRelations = relations(
  orgEntityResolutionCandidateVersions,
  ({ one }) => ({
    candidateGroup: one(orgEntityResolutionCandidateGroups, {
      fields: [orgEntityResolutionCandidateVersions.candidateGroupId],
      references: [orgEntityResolutionCandidateGroups.id],
    }),
  })
);

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
