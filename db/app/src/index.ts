// Schema exports

// Client
export { type Database, db } from "./client";

// Re-exported schema definitions
export * from "./schema";
export {
  type ClaimSignalForClassificationParams,
  claimSignalForClassification,
  type CreateSignalRecordInput,
  createSignal,
  type GetSignalByPublicIdParams,
  getSignalByPublicId,
  type MarkSignalClassifiedParams,
  markSignalClassified,
  type MarkSignalFailedParams,
  markSignalFailed,
} from "./utils/signals";

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
