// Schema exports

// Client
export { type Database, db } from "./client";

// Re-exported schema definitions
export * from "./schema";

// Utilities
export { buildOrgNamespace } from "./utils/org";
// Org source-control binding repository helpers
export {
  getActiveOrgBinding,
  isOrgBound,
  type MarkOrgBindingRevokedInput,
  markOrgBindingRevoked,
  type UpsertActiveOrgBindingInput,
  upsertActiveOrgBinding,
} from "./utils/org-binding";
export {
  getPersonByIdentityKey,
  type UpsertPeopleCandidate,
  type UpsertPeopleFromCandidatesInput,
  upsertPeopleFromCandidates,
} from "./utils/people";
export {
  type ClaimSignalForClassificationParams,
  type CreateSignalRecordInput,
  claimSignalForClassification,
  createSignal,
  type GetSignalByPublicIdParams,
  getSignalByPublicId,
  type MarkSignalClassifiedParams,
  type MarkSignalFailedParams,
  markSignalClassified,
  markSignalFailed,
} from "./utils/signals";
