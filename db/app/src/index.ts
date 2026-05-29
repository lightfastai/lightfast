// Schema exports

// Client
export { type Database, db, getClient } from "./client";

// Re-exported schema definitions
export {
  AUTOMATION_ID_PREFIX,
  AUTOMATION_RUN_ID_PREFIX,
  type Automation,
  type AutomationRun,
  type AutomationRunStatus,
  type AutomationRunTrigger,
  type AutomationScheduleConfig,
  type AutomationScheduleKind,
  type AutomationStatus,
  automationRuns,
  automations,
  createAutomationId,
  createAutomationRunId,
  createPersonId,
  createSignalId,
  type InsertAutomation,
  type InsertAutomationRun,
  type InsertOrgSourceControlBinding,
  type InsertPerson,
  type InsertSignal,
  type OrgSourceControlBinding,
  type OrgSourceControlBindingProvider,
  type OrgSourceControlBindingStatus,
  orgSourceControlBindings,
  PERSON_DISPLAY_NAME_LENGTH,
  PERSON_ID_PREFIX,
  PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH,
  type Person,
  type PersonIdentityProvider,
  type PersonIdentityType,
  people,
  type Signal,
  signals,
} from "./schema";
export {
  type ClaimedAutomationRun,
  type CreateAutomationInput,
  calculateNextRunAt,
  claimDueAutomationRuns,
  createAutomation,
  createAutomationRun,
  type GetAutomationByPublicIdInput,
  getAutomationByPublicId,
  getAutomationRunByIdempotencyKey,
  getAutomationRunByPublicId,
  listAutomationRuns,
  listAutomations,
  markAutomationRunCompleted,
  markAutomationRunFailed,
  markAutomationRunRunning,
  markAutomationRunSkipped,
  type NormalizedAutomationSchedule,
  normalizeAutomationSchedule,
  setAutomationStatus,
  type UpdateAutomationInput,
  updateAutomation,
} from "./utils/automations";
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
  type ListPeopleParams,
  listPeople,
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
  type ListSignalsParams,
  listSignals,
  type MarkSignalClassifiedParams,
  type MarkSignalFailedParams,
  markSignalClassified,
  markSignalFailed,
} from "./utils/signals";
