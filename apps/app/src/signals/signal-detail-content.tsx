import {
  CircleIcon as CircleDot,
  Flag01Icon as Flag,
  GaugeIcon as Gauge,
  Key01Icon as KeyRound,
  Link02Icon as Link2,
  Loading03Icon as LoaderCircle,
  Tag01Icon as Tag,
  UserGroupIcon as Users,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@repo/ui-v2/components/ui/badge";
import { Button } from "@repo/ui-v2/components/ui/button";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
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
  type SignalDetailRow,
  type SignalListItem,
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
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex w-36 shrink-0 items-center gap-2.5 text-muted-foreground text-sm">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1 text-foreground text-sm">{children}</div>
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
    <div className="space-y-1.5">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </h3>
      <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-relaxed">
        {children}
      </p>
    </div>
  );
}

/**
 * The header seeds instantly from the cached projection (`item`); the body
 * (`input`, `nextAction`, `rationale`, error fields, `updatedAt`) comes from the
 * full `detail` row. While the detail is loading, a body skeleton is shown.
 */
export function SignalDetailContent({
  bodyLoading,
  closeSlot,
  detail,
  item,
  onCopyLink,
}: {
  bodyLoading: boolean;
  closeSlot?: ReactNode;
  detail?: SignalDetailRow;
  item: SignalListItem;
  onCopyLink: () => void;
}) {
  const classification = detail?.classification ?? item.classification;
  const title = classification?.title ?? getSignalTitle(item);
  const source = getSignalSource(item);
  const createdAt = new Date(item.createdAt);
  const peopleRouting = classification?.routing.routes.people;
  const iconClass = "size-4 shrink-0";
  const detailClassification = detail?.classification;
  const summary = classification?.summary;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <span className="font-mono text-muted-foreground text-xs">
          {formatSignalIdentifier(item)}
        </span>
        {classification ? (
          <Badge variant="outline">
            {getSignalDispositionLabel(classification.disposition)}
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="Copy link"
            onClick={onCopyLink}
            size="icon-sm"
            title="Copy link"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon aria-hidden="true" icon={Link2} />
          </Button>
          {closeSlot}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <h2 className="pt-4 pb-5 font-semibold text-2xl text-foreground leading-tight tracking-tight">
          {title}
        </h2>

        <div className="flex flex-col">
          {classification ? (
            <PropertyRow
              icon={<HugeiconsIcon className={iconClass} icon={CircleDot} />}
              label="Disposition"
            >
              {getSignalDispositionLabel(classification.disposition)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow
              icon={<HugeiconsIcon className={iconClass} icon={Tag} />}
              label="Kind"
            >
              {getSignalKindLabel(classification.kind)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow
              icon={<HugeiconsIcon className={iconClass} icon={Flag} />}
              label="Priority"
            >
              {getSignalPriorityLabel(classification.priority)}
            </PropertyRow>
          ) : null}
          {classification ? (
            <PropertyRow
              icon={<HugeiconsIcon className={iconClass} icon={Gauge} />}
              label="Confidence"
            >
              {formatSignalConfidence(classification.confidence)}
            </PropertyRow>
          ) : null}
          <PropertyRow
            icon={<HugeiconsIcon className={iconClass} icon={LoaderCircle} />}
            label="Status"
          >
            {getSignalStatusLabel(item.status)}
          </PropertyRow>
          {peopleRouting ? (
            <PropertyRow
              icon={<HugeiconsIcon className={iconClass} icon={Users} />}
              label="People routing"
            >
              {peopleRouting.shouldRun ? "Yes" : "No"}
            </PropertyRow>
          ) : null}
          <PropertyRow
            icon={<HugeiconsIcon className={iconClass} icon={KeyRound} />}
            label="Source"
          >
            {source.label}
          </PropertyRow>
        </div>

        <div className="my-6 border-border/60 border-t" />

        {detail ? (
          <div className="flex flex-col gap-5">
            <BodySection label="Input">{detail.input}</BodySection>
            {summary ? (
              <BodySection label="Summary">{summary}</BodySection>
            ) : null}
            {detailClassification?.nextAction ? (
              <BodySection label="Next action">
                {detailClassification.nextAction}
              </BodySection>
            ) : null}
            {detailClassification?.rationale ? (
              <BodySection label="Rationale">
                {detailClassification.rationale}
              </BodySection>
            ) : null}
            {detail.status === "failed" ? (
              <div className="space-y-1.5">
                <h3 className="font-medium text-destructive text-xs uppercase tracking-wide">
                  Error
                </h3>
                {detail.errorCode ? (
                  <p className="font-mono text-destructive text-sm">
                    {detail.errorCode}
                  </p>
                ) : null}
                {detail.errorMessage ? (
                  <p className="text-muted-foreground text-sm">
                    {detail.errorMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : bodyLoading ? (
          <div
            className="flex flex-col gap-3"
            data-testid="signal-detail-body-skeleton"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        ) : null}
      </div>

      <div className="border-border/60 border-t px-5 py-3.5 text-muted-foreground text-xs">
        <span title={createdAt.toISOString()}>
          Created {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
        </span>
        {detail ? (
          <>
            <span aria-hidden="true"> · </span>
            <span title={new Date(detail.updatedAt).toISOString()}>
              Updated{" "}
              {formatRelativeTimeToNow(new Date(detail.updatedAt), {
                addSuffix: true,
              })}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
