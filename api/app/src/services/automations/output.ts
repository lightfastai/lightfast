import { createHash } from "node:crypto";
import type { ConnectableConnectorProvider } from "@lightfast/connector-core";

export const AUTOMATION_AI_OUTPUT_SCHEMA_VERSION = "automation.run.ai.v1";

export type RedactedPresence = { present: true } | null;

export type AutomationTranscriptToolName =
  | "callProviderRoutine"
  | "findProviderRoutines";
export type AutomationTranscriptToolStatus = "failed" | "succeeded";
export type AutomationTranscriptTextKind = "assistant" | "system" | "user";

export interface AutomationTranscriptTextEvent {
  content: string;
  contentHash: `sha256:${string}`;
  contentLength: number;
  kind: AutomationTranscriptTextKind;
  timestamp: string;
}

export interface AutomationTranscriptToolCallEvent {
  inputRedacted: RedactedPresence;
  kind: "tool_call";
  provider?: ConnectableConnectorProvider;
  providerToolName?: string;
  routineId?: string;
  timestamp: string;
  toolName: AutomationTranscriptToolName;
}

export interface AutomationTranscriptToolResultEvent {
  kind: "tool_result";
  outputRedacted: RedactedPresence;
  providerRoutineCallId?: string;
  routineCount?: number;
  routineId?: string;
  status: AutomationTranscriptToolStatus;
  timestamp: string;
  toolName: AutomationTranscriptToolName;
}

export interface AutomationTranscriptToolErrorEvent {
  errorCode: string;
  errorMessage: string;
  kind: "tool_error";
  providerRoutineCallId?: string;
  routineId?: string;
  timestamp: string;
  toolName: AutomationTranscriptToolName;
}

export type AutomationTranscriptEvent =
  | AutomationTranscriptTextEvent
  | AutomationTranscriptToolCallEvent
  | AutomationTranscriptToolErrorEvent
  | AutomationTranscriptToolResultEvent;

export type AutomationRunAiUsage = Record<string, unknown>;

export interface AutomationRunAiOutput {
  automationId: string;
  connectorProvider: ConnectableConnectorProvider | null;
  finalText: string;
  finishedAt: string;
  finishReason: string;
  model: string;
  providerRoutineCallIds: string[];
  runId: string;
  schemaVersion: typeof AUTOMATION_AI_OUTPUT_SCHEMA_VERSION;
  startedAt: string;
  transcript: AutomationTranscriptEvent[];
  usage: AutomationRunAiUsage;
}

export interface BuildAutomationRunOutputInput {
  automation: {
    connectorProvider: ConnectableConnectorProvider | null;
    name: string;
    prompt: string;
    publicId: string;
  };
  finishedAt: Date;
  model: string;
  result: {
    finishReason: unknown;
    text: string;
    totalUsage?: unknown;
    usage?: unknown;
  };
  run: {
    publicId: string;
  };
  startedAt: Date;
  transcriptEvents: readonly AutomationTranscriptEvent[];
}

export function createAutomationTranscriptRecorder(
  now: () => Date = () => new Date()
) {
  const events: AutomationTranscriptEvent[] = [];

  function recordText(kind: AutomationTranscriptTextKind, content: string) {
    events.push({
      content,
      contentHash: hashContent(content),
      contentLength: content.length,
      kind,
      timestamp: now().toISOString(),
    });
  }

  return {
    events() {
      return [...events];
    },

    recordAssistant(content: string) {
      recordText("assistant", content);
    },

    recordSystem(content: string) {
      recordText("system", content);
    },

    recordUser(content: string) {
      recordText("user", content);
    },

    recordToolCall(input: {
      input: unknown;
      provider?: ConnectableConnectorProvider;
      providerToolName?: string;
      routineId?: string;
      toolName: AutomationTranscriptToolName;
    }) {
      const event: AutomationTranscriptToolCallEvent = {
        inputRedacted: redactedPresence(input.input),
        kind: "tool_call",
        timestamp: now().toISOString(),
        toolName: input.toolName,
      };

      if (input.provider !== undefined) {
        event.provider = input.provider;
      }
      if (input.providerToolName !== undefined) {
        event.providerToolName = input.providerToolName;
      }
      if (input.routineId !== undefined) {
        event.routineId = input.routineId;
      }

      events.push(event);
    },

    recordToolResult(input: {
      output?: unknown;
      providerRoutineCallId?: string;
      routineCount?: number;
      routineId?: string;
      status: AutomationTranscriptToolStatus;
      toolName: AutomationTranscriptToolName;
    }) {
      const event: AutomationTranscriptToolResultEvent = {
        kind: "tool_result",
        outputRedacted: redactedPresence(input.output),
        status: input.status,
        timestamp: now().toISOString(),
        toolName: input.toolName,
      };

      if (input.providerRoutineCallId !== undefined) {
        event.providerRoutineCallId = input.providerRoutineCallId;
      }
      if (input.routineCount !== undefined) {
        event.routineCount = input.routineCount;
      }
      if (input.routineId !== undefined) {
        event.routineId = input.routineId;
      }

      events.push(event);
    },

    recordToolError(input: {
      errorCode: string;
      errorMessage: string;
      providerRoutineCallId?: string;
      routineId?: string;
      toolName: AutomationTranscriptToolName;
    }) {
      const event: AutomationTranscriptToolErrorEvent = {
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        kind: "tool_error",
        timestamp: now().toISOString(),
        toolName: input.toolName,
      };

      if (input.providerRoutineCallId !== undefined) {
        event.providerRoutineCallId = input.providerRoutineCallId;
      }
      if (input.routineId !== undefined) {
        event.routineId = input.routineId;
      }

      events.push(event);
    },
  };
}

export function buildAutomationRunOutput(
  input: BuildAutomationRunOutputInput
): AutomationRunAiOutput {
  const transcript = input.transcriptEvents.map(sanitizeTranscriptEvent);

  return {
    automationId: input.automation.publicId,
    connectorProvider: input.automation.connectorProvider,
    finalText: input.result.text,
    finishedAt: input.finishedAt.toISOString(),
    finishReason: stringifyFinishReason(input.result.finishReason),
    model: input.model,
    providerRoutineCallIds: collectProviderRoutineCallIds(transcript),
    runId: input.run.publicId,
    schemaVersion: AUTOMATION_AI_OUTPUT_SCHEMA_VERSION,
    startedAt: input.startedAt.toISOString(),
    transcript,
    usage: normalizeFirstUsage(input.result.totalUsage, input.result.usage),
  };
}

function sanitizeTranscriptEvent(
  event: AutomationTranscriptEvent
): AutomationTranscriptEvent {
  switch (event.kind) {
    case "assistant":
    case "system":
    case "user":
      return {
        content: event.content,
        contentHash: event.contentHash,
        contentLength: event.contentLength,
        kind: event.kind,
        timestamp: event.timestamp,
      };
    case "tool_call": {
      const sanitized: AutomationTranscriptToolCallEvent = {
        inputRedacted: canonicalRedactedPresence(event.inputRedacted),
        kind: "tool_call",
        timestamp: event.timestamp,
        toolName: event.toolName,
      };

      if (event.provider !== undefined) {
        sanitized.provider = event.provider;
      }
      if (event.providerToolName !== undefined) {
        sanitized.providerToolName = event.providerToolName;
      }
      if (event.routineId !== undefined) {
        sanitized.routineId = event.routineId;
      }

      return sanitized;
    }
    case "tool_result": {
      const sanitized: AutomationTranscriptToolResultEvent = {
        kind: "tool_result",
        outputRedacted: canonicalRedactedPresence(event.outputRedacted),
        status: event.status,
        timestamp: event.timestamp,
        toolName: event.toolName,
      };

      if (event.providerRoutineCallId !== undefined) {
        sanitized.providerRoutineCallId = event.providerRoutineCallId;
      }
      if (event.routineCount !== undefined) {
        sanitized.routineCount = event.routineCount;
      }
      if (event.routineId !== undefined) {
        sanitized.routineId = event.routineId;
      }

      return sanitized;
    }
    case "tool_error": {
      const sanitized: AutomationTranscriptToolErrorEvent = {
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
        kind: "tool_error",
        timestamp: event.timestamp,
        toolName: event.toolName,
      };

      if (event.providerRoutineCallId !== undefined) {
        sanitized.providerRoutineCallId = event.providerRoutineCallId;
      }
      if (event.routineId !== undefined) {
        sanitized.routineId = event.routineId;
      }

      return sanitized;
    }
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

function collectProviderRoutineCallIds(
  events: readonly AutomationTranscriptEvent[]
) {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    if (
      "providerRoutineCallId" in event &&
      typeof event.providerRoutineCallId === "string" &&
      event.providerRoutineCallId.length > 0 &&
      !seen.has(event.providerRoutineCallId)
    ) {
      seen.add(event.providerRoutineCallId);
      ids.push(event.providerRoutineCallId);
    }
  }

  return ids;
}

function hashContent(content: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function normalizeUsage(usage: unknown): AutomationRunAiUsage {
  if (!isRecord(usage)) {
    return {};
  }

  return { ...usage };
}

function normalizeFirstUsage(
  ...usageCandidates: readonly unknown[]
): AutomationRunAiUsage {
  for (const usage of usageCandidates) {
    if (isRecord(usage)) {
      return normalizeUsage(usage);
    }
  }

  return {};
}

function canonicalRedactedPresence(
  value: RedactedPresence | undefined
): RedactedPresence {
  return value === null || value === undefined ? null : { present: true };
}

function redactedPresence(value: unknown): RedactedPresence {
  return value === null || value === undefined ? null : { present: true };
}

function stringifyFinishReason(value: unknown) {
  return value === null || value === undefined ? "unknown" : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
