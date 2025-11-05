export type BillingInterval = "month" | "annual";

export enum DeusPlanKey {
  FREE = "free",
  PRO = "pro",
  TEAM = "team",
  ENTERPRISE = "enterprise",
}

export interface DeusPlanLimits {
  plan: DeusPlanKey;
  maxIntegrations: number;
  workflowRunsPerMonth: number;
  hasCollaboration: boolean;
  hasAuditLogs: boolean;
  hasSSO: boolean;
  hasPrioritySupport: boolean;
  hasPrivateIntegrations: boolean;
  hasSLA: boolean;
}

export const DEUS_LIMITS: Record<DeusPlanKey, DeusPlanLimits> = {
  [DeusPlanKey.FREE]: {
    plan: DeusPlanKey.FREE,
    maxIntegrations: 5,
    workflowRunsPerMonth: 100,
    hasCollaboration: false,
    hasAuditLogs: false,
    hasSSO: false,
    hasPrioritySupport: false,
    hasPrivateIntegrations: false,
    hasSLA: false,
  },
  [DeusPlanKey.PRO]: {
    plan: DeusPlanKey.PRO,
    maxIntegrations: -1, // unlimited
    workflowRunsPerMonth: 1000,
    hasCollaboration: false,
    hasAuditLogs: false,
    hasSSO: false,
    hasPrioritySupport: true,
    hasPrivateIntegrations: false,
    hasSLA: false,
  },
  [DeusPlanKey.TEAM]: {
    plan: DeusPlanKey.TEAM,
    maxIntegrations: -1, // unlimited
    workflowRunsPerMonth: 5000,
    hasCollaboration: true,
    hasAuditLogs: true,
    hasSSO: false,
    hasPrioritySupport: true,
    hasPrivateIntegrations: false,
    hasSLA: false,
  },
  [DeusPlanKey.ENTERPRISE]: {
    plan: DeusPlanKey.ENTERPRISE,
    maxIntegrations: -1, // unlimited
    workflowRunsPerMonth: -1, // unlimited
    hasCollaboration: true,
    hasAuditLogs: true,
    hasSSO: true,
    hasPrioritySupport: true,
    hasPrivateIntegrations: true,
    hasSLA: true,
  },
} as const;

export function getLimitsForPlan(planKey: DeusPlanKey): DeusPlanLimits {
  return DEUS_LIMITS[planKey] ?? DEUS_LIMITS[DeusPlanKey.FREE];
}
