// Schema exports

// Client
export { type Database, db } from "./client";

// Re-exported schema definitions
export * from "./schema";
export {
  type CreateOpportunityInput,
  createOpportunity,
  type GetOpportunityByIdInput,
  getOpportunityById,
  type MarkOpportunityClassifiedInput,
  type MarkOpportunityFailedInput,
  type MarkOpportunityProcessingInput,
  markOpportunityClassified,
  markOpportunityFailed,
  markOpportunityProcessing,
} from "./utils/opportunities";

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
