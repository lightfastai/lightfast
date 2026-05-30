"use client";

import { Button } from "@repo/ui/components/ui/button";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  Calendar,
  CircleDot,
  Flag,
  Gauge,
  KeyRound,
  Link2,
  LoaderCircle,
  Tag,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  formatSignalConfidence,
  formatSignalIdentifier,
  getSignalDispositionLabel,
  getSignalKindLabel,
  getSignalPriorityLabel,
  getSignalSource,
  getSignalStatusLabel,
  getSignalTitle,
  type SignalRow,
} from "./signals-model";

function PropertyRow({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-2 py-1.5">
      <span className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        {label}
      </span>
      <div className="min-w-0 text-foreground text-sm">{children}</div>
    </div>
  );
}

function BodySection({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </h3>
      <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-6">
        {children}
      </p>
    </div>
  );
}

export function SignalDetailContent({
  closeSlot,
  onCopyLink,
  signal,
}: {
  closeSlot?: ReactNode;
  onCopyLink: () => void;
  signal: SignalRow;
}) {
  const classification = signal.classification;
  const title = getSignalTitle(signal);
  const source = getSignalSource(signal);
  const createdAt = new Date(signal.createdAt);
  const updatedAt = new Date(signal.updatedAt);
  const peopleRouting = classification?.routing?.classifyPeople;
  const iconClass = "size-3.5 shrink-0";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-4">
        <span className="font-mono text-muted-foreground text-xs">
          {formatSignalIdentifier(signal)}
        </span>
        {classification ? (
          <span className="rounded-full border border-border/70 px-2 py-0.5 text-muted-foreground text-xs">
            {getSignalDispositionLabel(classification.disposition)}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="Copy link"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground"
            onClick={onCopyLink}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Link2 aria-hidden="true" className="size-4" />
          </Button>
          {closeSlot}
        </div>
      </div>

      <div className="overflow-y-auto px-4 pb-4">
        <h2 className="pt-3 pb-4 font-semibold text-foreground text-xl leading-tight">
          {title}
        </h2>

        <div className="divide-y divide-border/40">
          {classification ? (
            <PropertyRow
              icon={<CircleDot className={iconClass} />}
              label="Disposition"
            >
              {getSignalDispositionLabel(classification.disposition)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow icon={<Tag className={iconClass} />} label="Kind">
              {getSignalKindLabel(classification.kind)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow icon={<Flag className={iconClass} />} label="Priority">
              {getSignalPriorityLabel(classification.priority)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow
              icon={<Gauge className={iconClass} />}
              label="Confidence"
            >
              {formatSignalConfidence(classification.confidence)}
            </PropertyRow>
          ) : null}
          <PropertyRow
            icon={<LoaderCircle className={iconClass} />}
            label="Status"
          >
            {getSignalStatusLabel(signal.status)}
          </PropertyRow>
          {peopleRouting ? (
            <PropertyRow
              icon={<Users className={iconClass} />}
              label="People routing"
            >
              <span>{peopleRouting.shouldRun ? "Yes" : "No"}</span>
              {peopleRouting.rationale ? (
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {peopleRouting.rationale}
                </p>
              ) : null}
            </PropertyRow>
          ) : null}
          <PropertyRow icon={<KeyRound className={iconClass} />} label="Source">
            {source.label}
          </PropertyRow>
          <PropertyRow
            icon={<Calendar className={iconClass} />}
            label="Created"
          >
            <time
              dateTime={createdAt.toISOString()}
              title={createdAt.toISOString()}
            >
              {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
            </time>
          </PropertyRow>
        </div>

        <div className="mt-6 space-y-5 border-border/60 border-t pt-5">
          <BodySection label="Input">{signal.input}</BodySection>
          {classification?.summary ? (
            <BodySection label="Summary">{classification.summary}</BodySection>
          ) : null}
          {classification?.nextAction ? (
            <BodySection label="Next action">
              {classification.nextAction}
            </BodySection>
          ) : null}
          {classification?.rationale ? (
            <BodySection label="Rationale">
              {classification.rationale}
            </BodySection>
          ) : null}
          {signal.status === "failed" ? (
            <div className="space-y-1">
              <h3 className="font-medium text-destructive text-xs uppercase tracking-wide">
                Error
              </h3>
              {signal.errorCode ? (
                <p className="font-mono text-destructive text-sm">
                  {signal.errorCode}
                </p>
              ) : null}
              {signal.errorMessage ? (
                <p className="text-muted-foreground text-sm">
                  {signal.errorMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6 border-border/60 border-t pt-4 text-muted-foreground text-xs">
          <span title={createdAt.toISOString()}>
            Created {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
          </span>
          <span aria-hidden="true"> · </span>
          <span title={updatedAt.toISOString()}>
            Updated {formatRelativeTimeToNow(updatedAt, { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
