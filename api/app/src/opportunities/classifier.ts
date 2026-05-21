import {
  type OpportunityClassification,
  opportunityClassificationSchema,
} from "@repo/api-contract";
import { generateText, Output } from "ai";

export const OPPORTUNITY_CLASSIFIER_MODEL = "moonshotai/kimi-k2.6";

export const OPPORTUNITY_CLASSIFIER_SYSTEM_PROMPT = `You are the Lightfast opportunity classifier.

You receive one raw text input submitted by an external automation or user.
Your job is to decide whether the input describes a useful opportunity for the user to act on.

An opportunity is a possible action worth considering. It may be a task, reminder, follow-up, review item, reply opportunity, investigation lead, or anything else that could be useful work.

Do not execute the action.
Do not browse the web.
Do not invent facts not present in the input.
Do not assume private context that was not provided.
Preserve uncertainty.

Field rules:
- title: short, human-readable, max 80 characters.
- summary: one sentence describing the opportunity.
- nextAction: one concrete action the user could take next.
- rationale: brief explanation of why this classification was chosen.
- confidence: number from 0 to 1.
- Use disposition "needs_context" when the input might be useful but lacks enough detail.
- Use disposition "not_actionable" when the input is noise, spam, purely descriptive, or has no plausible user action.
- Use priority "urgent" only when the input implies immediate time sensitivity or blocking impact.`;

export async function classifyOpportunityInput(
  input: string
): Promise<OpportunityClassification> {
  const { output } = await generateText({
    model: OPPORTUNITY_CLASSIFIER_MODEL,
    output: Output.object({ schema: opportunityClassificationSchema }),
    system: OPPORTUNITY_CLASSIFIER_SYSTEM_PROMPT,
    prompt: `Classify this opportunity input:\n\n${input}`,
  });

  return output;
}
