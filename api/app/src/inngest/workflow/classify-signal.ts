import {
  claimSignalForClassification,
  getSignalByPublicId,
  markSignalClassified,
  markSignalFailed,
} from "@db/app";
import { db } from "@db/app/client";
import {
  type SignalClassification,
  signalClassificationSchema,
} from "@repo/api-contract";
import { generateText, Output } from "ai";

import { inngest } from "../client";

export const SIGNAL_CLASSIFIER_MODEL = "moonshotai/kimi-k2.6";
export const SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE =
  "CLASSIFICATION_FAILED";

export const SIGNAL_CLASSIFIER_SYSTEM_PROMPT = `You are the Lightfast signal classifier.

You receive one raw text input submitted by an external automation or user.
Your job is to decide whether the input describes a useful signal for the user to act on.

A signal is a possible action worth considering. It may be a task, reminder, follow-up, review item, reply opening, investigation lead, or anything else that could be useful work.

Do not execute the action.
Do not browse the web.
Do not invent facts not present in the input.
Do not assume private context that was not provided.
Preserve uncertainty.

Field rules:
- title: short, human-readable, max 80 characters.
- summary: one sentence describing the signal.
- kind: the kind of signal — one of "engage", "follow_up", "review", "fix", "investigate", "remember", or "other".
- nextAction: one concrete action the user could take next.
- rationale: brief explanation of why this classification was chosen.
- confidence: number from 0 to 1.
- Use disposition "needs_context" when the input might be useful but lacks enough detail.
- Use disposition "not_actionable" when the input is noise, spam, purely descriptive, or has no plausible user action.
- Use priority "urgent" only when the input implies immediate time sensitivity or blocking impact.`;

export interface SignalClassificationRequest {
  model: string;
  system: string;
  prompt: string;
}

export function buildSignalClassificationRequest(
  input: string
): SignalClassificationRequest {
  return {
    model: SIGNAL_CLASSIFIER_MODEL,
    system: SIGNAL_CLASSIFIER_SYSTEM_PROMPT,
    prompt: `Classify this signal input:\n\n${input}`,
  };
}

// `schemaVersion` is a fixed, code-owned literal — the model must not be asked
// to generate it. Classify against the model-owned fields only, then stamp the
// version server-side.
const signalClassificationModelSchema = signalClassificationSchema.omit({
  schemaVersion: true,
});

export async function classifySignalInput({
  model,
  prompt,
  system,
}: SignalClassificationRequest): Promise<SignalClassification> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: signalClassificationModelSchema }),
    system,
    prompt,
  });

  return { schemaVersion: "signal.classification.v1", ...output };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const classifySignal = inngest.createFunction(
  { id: "classify-signal" },
  { event: "app/signal.created" },
  async ({ event, step }) => {
    const { clerkOrgId, signalId } = event.data;

    const signal = await step.run("load signal", () =>
      getSignalByPublicId(db, {
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!signal) {
      return { status: "missing" };
    }

    const claimed = await step.run("claim signal", () =>
      claimSignalForClassification(db, {
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!claimed) {
      return { status: "skipped" };
    }

    const classificationRequest = buildSignalClassificationRequest(signal.input);
    let classification: SignalClassification;
    try {
      classification = await step.ai.wrap(
        "classify signal",
        classifySignalInput,
        classificationRequest
      );
    } catch (error) {
      await step.run("mark signal failed", () =>
        markSignalFailed(db, {
          clerkOrgId,
          errorCode: SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE,
          errorMessage: getErrorMessage(error),
          publicId: signalId,
        })
      );
      return { status: "failed" };
    }

    const persisted = await step.run("persist signal classification", () =>
      markSignalClassified(db, {
        classification,
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!persisted) {
      return { status: "skipped" };
    }

    return { status: "classified" };
  }
);
