"use client";

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@repo/ui/components/ai-elements/code-block";
import { SSRCodeBlockCopyButton } from "@repo/ui/components/ssr-code-block";
import { cn } from "@repo/ui/lib/utils";
import { formatDuration } from "@vendor/lib/time";
import type { ReactNode } from "react";
import {
  type DecisionRow,
  formatCaller,
  getSourceLabel,
} from "./decisions-model";

export function DecisionsDetail({ decision }: { decision: DecisionRow }) {
  const durationLabel = decision.finishedAt
    ? formatDuration(
        decision.finishedAt.getTime() - decision.startedAt.getTime()
      )
    : "—";
  const finishedLabel = decision.finishedAt
    ? decision.finishedAt.toISOString()
    : "Running";

  return (
    <div className="border-border/40 border-t bg-muted/10 px-4 py-4">
      <dl className="grid gap-x-8 sm:grid-cols-2">
        <DetailField
          copyValue={decision.publicId}
          label="Decision ID"
          mono
          value={decision.publicId}
        />
        <DetailField
          copyValue={decision.routineId}
          label="Routine"
          mono
          value={decision.routineId}
        />
        <DetailField
          copyValue={decision.providerToolName}
          label="Provider tool"
          mono
          value={decision.providerToolName}
        />
        <DetailField label="Caller" value={formatCaller(decision)} />
        <DetailField
          label="Source"
          value={getSourceLabel(decision.sourceSurface)}
        />
        <DetailField
          copyValue={String(decision.providerConnectionId)}
          label="Provider connection"
          mono
          value={String(decision.providerConnectionId)}
        />
        {decision.providerWorkspaceId ? (
          <DetailField
            copyValue={decision.providerWorkspaceId}
            label="Provider workspace"
            mono
            value={decision.providerWorkspaceId}
          />
        ) : null}
        {decision.providerActorId ? (
          <DetailField
            copyValue={decision.providerActorId}
            label="Provider actor"
            mono
            value={decision.providerActorId}
          />
        ) : null}
        <DetailField
          copyValue={decision.startedAt.toISOString()}
          label="Started"
          mono
          value={decision.startedAt.toISOString()}
        />
        <DetailField
          copyValue={decision.finishedAt?.toISOString()}
          label="Finished"
          mono={Boolean(decision.finishedAt)}
          value={finishedLabel}
        />
        <DetailField label="Duration" value={durationLabel} />
      </dl>

      {decision.errorCode || decision.errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-destructive text-xs">
              {decision.errorCode ?? "Error"}
            </p>
            {decision.errorMessage ? (
              <SSRCodeBlockCopyButton
                className="text-muted-foreground"
                code={decision.errorMessage}
              />
            ) : null}
          </div>
          {decision.errorMessage ? (
            <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-destructive/90 text-xs">
              {decision.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {decision.inputRedacted ? (
        <PayloadBlock payload={decision.inputRedacted} title="Input" />
      ) : null}
      {decision.outputRedacted ? (
        <PayloadBlock payload={decision.outputRedacted} title="Output" />
      ) : null}
    </div>
  );
}

function DetailField({
  copyValue,
  label,
  mono,
  value,
}: {
  copyValue?: string;
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="group/field flex flex-col gap-1 border-border/40 border-t py-2.5 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex items-start gap-1.5 text-foreground text-sm">
        <span className={cn("min-w-0 break-all", mono && "font-mono text-xs")}>
          {value}
        </span>
        {copyValue ? (
          <SSRCodeBlockCopyButton
            className="shrink-0 opacity-0 transition-opacity group-hover/field:opacity-100"
            code={copyValue}
          />
        ) : null}
      </dd>
    </div>
  );
}

function PayloadBlock({
  payload,
  title,
}: {
  payload: Record<string, unknown>;
  title: string;
}) {
  const code = JSON.stringify(payload, null, 2);
  return (
    <div className="mt-4">
      <CodeBlock code={code} language="json">
        <CodeBlockHeader>
          <CodeBlockTitle>{title}</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    </div>
  );
}
