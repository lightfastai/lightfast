import { z } from "zod";

import type { DotLightfastConfig } from "./types";

export const TriageDecisionSchema = z.object({
  decision: z.enum(["skip", "invoke"]),
  skillName: z.string().optional(),
  reasoning: z.string().min(1).max(500),
});

export type TriageDecision = z.infer<typeof TriageDecisionSchema>;

export interface TriageEventContext {
  content: string;
  externalId: string;
  observationType: string;
  occurredAt: string;
  significanceScore: number;
  source: string;
  sourceType: string;
  title: string;
}

export function buildTriageSystemPrompt(config: DotLightfastConfig): string {
  const parts: string[] = [];

  parts.push(
    "You are Lightfast's triage agent. For each event you receive, decide whether any configured skill should run.",
    "Output one of: skip (no skill is appropriate) or invoke (select exactly one skill by name).",
    "Be decisive. If no skill clearly applies, pick skip."
  );

  if (config.spec) {
    parts.push("", "## Organization SPEC", config.spec.trim());
  }

  if (config.skills.length > 0) {
    parts.push("", "## Available Skills");
    for (const skill of config.skills) {
      parts.push(`- **${skill.name}**: ${skill.description}`);
    }
  } else {
    parts.push("", "## Available Skills", "(none configured)");
  }

  parts.push(
    "",
    "## Output rules",
    "- If you choose invoke, skillName MUST exactly match one of the skill names above.",
    "- If you choose skip, omit skillName.",
    "- reasoning must be one or two short sentences explaining your choice."
  );

  return parts.join("\n");
}

export function buildTriageUserPrompt(event: TriageEventContext): string {
  return [
    `Event: ${event.source}/${event.sourceType} (${event.observationType})`,
    `Occurred: ${event.occurredAt}`,
    `Significance: ${event.significanceScore}`,
    `Title: ${event.title}`,
    "",
    "Content:",
    event.content.slice(0, 4000),
  ].join("\n");
}
