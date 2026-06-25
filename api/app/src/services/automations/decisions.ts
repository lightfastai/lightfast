import { db } from "@db/app/client";
import {
  type DecisionDetail,
  type DecisionFindInput,
  type DecisionFindOutput,
  type DecisionGetInput,
  decisionFindInputSchema,
  decisionFindOutputSchema,
  decisionGetInputSchema,
  decisionGetOutputSchema,
} from "@repo/api-contract";
import { findDecisions, getDecision } from "../decisions";

export interface AutomationDecisionContext {
  automationPublicId: string;
  clerkOrgId: string;
  runPublicId: string;
}

export async function findAutomationDecisions(
  context: AutomationDecisionContext,
  input: DecisionFindInput
): Promise<DecisionFindOutput> {
  const parsed = decisionFindInputSchema.parse(input);
  const result = await findDecisions(db, {
    clerkOrgId: context.clerkOrgId,
    ...parsed,
  });
  return decisionFindOutputSchema.parse(result);
}

export async function getAutomationDecision(
  context: AutomationDecisionContext,
  input: DecisionGetInput
): Promise<DecisionDetail | undefined> {
  const parsed = decisionGetInputSchema.parse(input);
  const result = await getDecision(db, {
    clerkOrgId: context.clerkOrgId,
    id: parsed.id,
  });
  return result ? decisionGetOutputSchema.parse(result) : undefined;
}
