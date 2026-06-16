import { Badge } from "@repo/ui/components/ui/badge";
import type { ReactNode } from "react";

const CONNECTOR_LABELS = {
  linear: "Linear",
  x: "X",
} as const;

type ConnectorProvider = keyof typeof CONNECTOR_LABELS;

interface AutomationRunAiOutput {
  connectorProvider: ConnectorProvider | null;
  finalText: string;
  finishReason: string;
  model: string;
  providerRoutineCallIds: string[];
  schemaVersion: "automation.run.ai.v1";
  transcript: Array<Record<string, unknown> & { kind?: unknown }>;
  usage: Record<string, unknown>;
}

export function isAutomationRunAiOutput(
  output: unknown
): output is AutomationRunAiOutput {
  if (!isRecord(output)) {
    return false;
  }

  return (
    output.schemaVersion === "automation.run.ai.v1" &&
    typeof output.finalText === "string" &&
    typeof output.finishReason === "string" &&
    typeof output.model === "string" &&
    (output.connectorProvider === null ||
      isConnectorProvider(output.connectorProvider)) &&
    Array.isArray(output.providerRoutineCallIds) &&
    output.providerRoutineCallIds.every((id) => typeof id === "string") &&
    Array.isArray(output.transcript) &&
    output.transcript.every(isRecord) &&
    isRecord(output.usage)
  );
}

export function AutomationRunAiOutputView({
  output,
}: {
  output: AutomationRunAiOutput;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Summary
        </h3>
        <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-foreground text-sm leading-relaxed">
          {output.finalText}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <OutputMeta label="Connector">
          {output.connectorProvider
            ? CONNECTOR_LABELS[output.connectorProvider]
            : "-"}
        </OutputMeta>
        <OutputMeta label="Finish">{output.finishReason}</OutputMeta>
        <OutputMeta label="Model">{output.model}</OutputMeta>
        <OutputMeta label="Tokens">
          {typeof output.usage.totalTokens === "number"
            ? output.usage.totalTokens
            : "-"}
        </OutputMeta>
      </div>

      {output.providerRoutineCallIds.length > 0 ? (
        <div className="space-y-1.5">
          <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Provider routine calls
          </h3>
          <div className="space-y-1">
            {output.providerRoutineCallIds.map((id) => (
              <div
                className="break-all rounded-md border border-border/60 bg-background px-2.5 py-1.5 font-mono text-muted-foreground text-xs"
                key={id}
              >
                {id}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Transcript
        </h3>
        <div className="space-y-2">
          {output.transcript.map((event, index) => (
            <TranscriptEvent event={event} index={index} key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OutputMeta({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-md border border-border/60 px-2.5 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-0.5 break-words text-foreground">{children}</div>
    </div>
  );
}

function TranscriptEvent({
  event,
  index,
}: {
  event: Record<string, unknown> & { kind?: unknown };
  index: number;
}) {
  const kind = typeof event.kind === "string" ? event.kind : "event";
  const routineId =
    typeof event.routineId === "string" ? event.routineId : undefined;
  const providerRoutineCallId =
    typeof event.providerRoutineCallId === "string"
      ? event.providerRoutineCallId
      : undefined;
  const content =
    (kind === "assistant" || kind === "system" || kind === "user") &&
    typeof event.content === "string"
      ? event.content
      : undefined;
  const redacted =
    ("inputRedacted" in event && event.inputRedacted) ||
    ("outputRedacted" in event && event.outputRedacted);

  return (
    <div className="rounded-md border border-border/60 px-2.5 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="px-1.5 text-muted-foreground" variant="secondary">
          {index + 1}
        </Badge>
        <Badge className="px-1.5" variant="outline">
          {kind.replaceAll("_", " ")}
        </Badge>
        {redacted ? (
          <Badge className="px-1.5 text-muted-foreground" variant="secondary">
            payload redacted
          </Badge>
        ) : null}
      </div>
      {content ? <p className="mt-2 text-muted-foreground">{content}</p> : null}
      {routineId ? (
        <p className="mt-2 break-all font-mono text-muted-foreground text-xs">
          {routineId}
        </p>
      ) : null}
      {providerRoutineCallId ? (
        <p className="mt-1 break-all font-mono text-muted-foreground text-xs">
          {providerRoutineCallId}
        </p>
      ) : null}
    </div>
  );
}

function isConnectorProvider(value: unknown): value is ConnectorProvider {
  return value === "linear" || value === "x";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
