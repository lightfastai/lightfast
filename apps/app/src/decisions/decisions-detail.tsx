import { SSRCodeBlockCopyButton } from "@repo/ui/components/ssr-code-block/copy-button";
import { formatDuration, formatRelativeTimeToNow } from "@vendor/lib/time";
import type { ReactNode } from "react";
import {
  type DecisionRow,
  formatCaller,
  getSourceLabel,
} from "./decisions-model";

export function DecisionsDetail({ decision }: { decision: DecisionRow }) {
  const startedIso = decision.startedAt.toISOString();
  const finishedIso = decision.finishedAt?.toISOString();
  const durationLabel = decision.finishedAt
    ? formatDuration(
        decision.finishedAt.getTime() - decision.startedAt.getTime()
      )
    : "-";
  const hasError = Boolean(decision.errorCode || decision.errorMessage);

  return (
    <div className="border-border/40 border-t bg-muted/10 px-4 py-4">
      <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
        <DetailGroup title="Identity">
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
          <DetailField
            copyValue={String(decision.providerConnectionId)}
            label="Connection"
            mono
            value={String(decision.providerConnectionId)}
          />
          {decision.providerWorkspaceId ? (
            <DetailField
              copyValue={decision.providerWorkspaceId}
              label="Workspace"
              mono
              value={decision.providerWorkspaceId}
            />
          ) : null}
          {decision.providerActorId ? (
            <DetailField
              copyValue={decision.providerActorId}
              label="Actor"
              mono
              value={decision.providerActorId}
            />
          ) : null}
        </DetailGroup>

        <DetailGroup title="Timing & source">
          <DetailField
            copyValue={startedIso}
            label="Started"
            mono
            value={startedIso}
          />
          <DetailField
            copyValue={finishedIso}
            label="Finished"
            mono={Boolean(finishedIso)}
            value={finishedIso ?? "Running"}
          />
          <DetailField label="Duration" value={durationLabel} />
          <DetailField
            label="Source"
            value={
              <span className="inline-flex h-5 items-center rounded-md border border-border/70 bg-muted/25 px-1.5 text-muted-foreground text-xs">
                {getSourceLabel(decision.sourceSurface)}
              </span>
            }
          />
          <DetailField label="Caller" value={formatCaller(decision)} />
          <DetailField
            label="Attempted"
            value={decision.providerAttempted ? "Yes - reached provider" : "No"}
          />
        </DetailGroup>

        {decision.inputRedacted ? (
          <DetailGroup className="sm:col-span-2" title="Input payload">
            <PayloadBlock payload={decision.inputRedacted} title="Input" />
          </DetailGroup>
        ) : null}

        {decision.outputRedacted ? (
          <DetailGroup className="sm:col-span-2" title="Output payload">
            <PayloadBlock payload={decision.outputRedacted} title="Output" />
          </DetailGroup>
        ) : null}

        {hasError ? (
          <DetailGroup className="sm:col-span-2" title="Error">
            {decision.errorCode ? (
              <DetailField
                label="Code"
                value={
                  <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
                    {decision.errorCode}
                  </span>
                }
              />
            ) : null}
            {decision.errorMessage ? (
              <ErrorMessageBox message={decision.errorMessage} />
            ) : null}
          </DetailGroup>
        ) : null}
      </div>

      <p className="mt-5 border-border/40 border-t pt-3 text-muted-foreground text-xs">
        Created{" "}
        {formatRelativeTimeToNow(decision.createdAt, { addSuffix: true })} /
        updated{" "}
        {formatRelativeTimeToNow(decision.updatedAt, { addSuffix: true })}
      </p>
    </div>
  );
}

function DetailGroup({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <div className={className}>
      <h4 className="mb-2.5 font-semibold text-muted-foreground/80 text-xs uppercase tracking-wide">
        {title}
      </h4>
      <dl className="grid gap-y-0.5">{children}</dl>
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
    <div className="group/field grid grid-cols-[7rem_1fr] items-start gap-3 py-1">
      <dt className="pt-0.5 text-muted-foreground text-xs">{label}</dt>
      <dd className="flex min-w-0 items-start gap-1.5">
        {mono ? (
          <code className="min-w-0 break-all rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-foreground text-xs">
            {value}
          </code>
        ) : (
          <span className="min-w-0 break-words text-foreground text-xs">
            {value}
          </span>
        )}
        {copyValue ? (
          <SSRCodeBlockCopyButton
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/field:opacity-100"
            code={copyValue}
          />
        ) : null}
      </dd>
    </div>
  );
}

function ErrorMessageBox({ message }: { message: string }) {
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-destructive/30 bg-destructive/5">
      <div className="flex items-center justify-between gap-2 border-destructive/20 border-b px-3 py-1.5">
        <span className="font-mono text-destructive/80 text-xs">
          errorMessage
        </span>
        <SSRCodeBlockCopyButton
          className="text-destructive/70"
          code={message}
        />
      </div>
      <p className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-destructive text-xs">
        {message}
      </p>
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
  const keyCount = Object.keys(payload).length;
  const code = JSON.stringify(payload, null, 2);
  return (
    <div className="overflow-hidden rounded-md border border-border/70 bg-background">
      <div className="flex items-center justify-between gap-2 border-border/70 border-b bg-muted/50 px-3 py-2">
        <span className="font-medium text-muted-foreground text-xs">
          {title} / {keyCount} {keyCount === 1 ? "key" : "keys"}
        </span>
        <SSRCodeBlockCopyButton
          className="shrink-0 text-muted-foreground"
          code={code}
        />
      </div>
      <pre className="max-h-[28rem] overflow-auto p-3">
        <code className="block whitespace-pre font-mono text-foreground text-xs leading-5">
          {code}
        </code>
      </pre>
    </div>
  );
}
