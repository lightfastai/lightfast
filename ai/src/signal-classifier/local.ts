import {
  type SignalClassification,
  signalClassificationSchema,
  type signalKindSchema,
  type signalPrioritySchema,
} from "@repo/api-contract";
import type { z } from "zod";

import { extractDeterministicSignalEntityLinks } from "../signal-entity-linker/extract";
import { SIGNAL_CLASSIFICATION_SCHEMA_VERSION } from "./constants";

type SignalKind = z.infer<typeof signalKindSchema>;
type SignalPriority = z.infer<typeof signalPrioritySchema>;

export interface LocalSignalClassificationInput {
  input: string;
  signalId: string;
}

export function classifySignalInputLocally(
  input: LocalSignalClassificationInput
): SignalClassification {
  const normalizedInput = normalizeInput(input.input);
  const deterministicCandidates = extractDeterministicSignalEntityLinks({
    input: input.input,
  });
  const hasExplicitPersonIdentity = deterministicCandidates.length > 0;
  const kind = inferSignalKind(normalizedInput);
  const priority = inferSignalPriority(normalizedInput);

  return signalClassificationSchema.parse({
    schemaVersion: SIGNAL_CLASSIFICATION_SCHEMA_VERSION,
    disposition: "actionable",
    title: buildTitle(normalizedInput),
    summary: hasExplicitPersonIdentity
      ? "Local development classifier found explicit person identities in the signal."
      : "Local development classifier routed the signal without external AI.",
    kind,
    nextAction: inferNextAction(kind, hasExplicitPersonIdentity),
    priority,
    rationale: hasExplicitPersonIdentity
      ? "Local development classifier uses deterministic emails, handles, and profile URLs when AI Gateway credentials are unavailable."
      : "Local development classifier keeps keyless local dev usable while preserving production AI classification.",
    confidence: hasExplicitPersonIdentity ? 0.8 : 0.55,
    routing: {
      visibility: {
        scope: hasExplicitPersonIdentity ? "team" : "user",
        rationale: hasExplicitPersonIdentity
          ? "Local development classifier found explicit person identity handles or profile URLs."
          : "Local development classifier did not find explicit durable person identities.",
      },
      review: {
        required: false,
        reason: null,
        rationale: null,
      },
      routes: {
        people: {
          shouldRun: hasExplicitPersonIdentity,
          confidence: hasExplicitPersonIdentity ? 0.8 : 0,
          rationale: hasExplicitPersonIdentity
            ? "Local development classifier found deterministic person identity candidates."
            : "Local development classifier only routes explicit durable person identities.",
        },
      },
    },
  });
}

function normalizeInput(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function buildTitle(input: string): string {
  const firstSentence = input.split(/[.!?]/u)[0]?.trim() ?? "";
  const title = firstSentence.length > 0 ? firstSentence : "Local signal";

  return title.length <= 80 ? title : `${title.slice(0, 77).trimEnd()}...`;
}

function inferSignalKind(input: string): SignalKind {
  const lower = input.toLowerCase();

  if (lower.includes("follow up") || lower.includes("follow-up")) {
    return "follow_up";
  }

  if (lower.includes("review")) {
    return "review";
  }

  if (lower.includes("fix")) {
    return "fix";
  }

  if (lower.includes("investigate") || lower.includes("debug")) {
    return "investigate";
  }

  if (lower.includes("remember") || lower.includes("note")) {
    return "remember";
  }

  if (
    lower.includes("engage") ||
    lower.includes("reply") ||
    lower.includes("message") ||
    lower.includes("dm ")
  ) {
    return "engage";
  }

  return "other";
}

function inferSignalPriority(input: string): SignalPriority {
  const lower = input.toLowerCase();

  if (lower.includes("urgent") || lower.includes("asap")) {
    return "urgent";
  }

  if (lower.includes("high priority") || lower.includes("important")) {
    return "high";
  }

  return "normal";
}

function inferNextAction(
  kind: SignalKind,
  hasExplicitPersonIdentity: boolean
): string {
  if (hasExplicitPersonIdentity) {
    return "Review the referenced person identities and decide the next outreach step.";
  }

  if (kind === "remember") {
    return "Keep the note available to the creator.";
  }

  return "Review the signal when local AI credentials are available.";
}
