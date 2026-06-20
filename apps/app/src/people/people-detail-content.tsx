import { getSignal } from "@api/app/tanstack/signals";
import {
  AtSignIcon as AtSign,
  HashIcon as Hash,
  Link02Icon as Link2,
  SignalIcon,
  SparklesIcon as Sparkles,
  Tag01Icon as Tag,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import type { ReactNode } from "react";
import {
  formatPersonSignalRef,
  getPersonName,
  getPersonProviderLabel,
  getPersonTypeLabel,
  type PersonRow,
} from "./people-model";
import { PersonProviderIcon } from "./people-provider-icon";

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
      <div className="min-w-0 flex-1 break-words text-foreground text-sm">
        {children}
      </div>
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
      <div className="whitespace-pre-wrap break-words text-foreground text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function PersonSignalLink({
  signalId,
  slug,
}: {
  signalId: string;
  slug: string;
}) {
  const query = useQuery({
    enabled: typeof window !== "undefined" && Boolean(signalId),
    queryFn: () => getSignal({ data: { publicId: signalId } }),
    queryKey: ["signals", "detail", signalId] as const,
  });
  const title = query.data
    ? (query.data.classification?.title ?? query.data.input)
    : null;

  return (
    <Link
      className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 hover:bg-muted/30"
      params={{ slug }}
      search={{ signal: signalId }}
      to="/$slug/signals"
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3.5 text-muted-foreground"
        icon={SignalIcon}
      />
      <span className="font-mono text-muted-foreground text-xs">
        {formatPersonSignalRef(signalId)}
      </span>
      <span className="min-w-0 truncate text-foreground text-sm">
        {title ?? "Open signal"}
      </span>
    </Link>
  );
}

export function PeopleDetailContent({
  closeSlot,
  onCopyLink,
  person,
  slug,
}: {
  closeSlot?: ReactNode;
  onCopyLink: () => void;
  person: PersonRow;
  slug: string;
}) {
  const name = getPersonName(person);
  const createdAt = new Date(person.createdAt);
  const updatedAt = new Date(person.updatedAt);
  const metadata = person.metadata as {
    confidence?: number;
    rationale?: string;
    source?: string;
  };
  const iconClass = "size-4 shrink-0";
  const firstSeen = person.firstSeenSignalId;
  const lastSeen = person.lastSeenSignalId;
  const signalIds = Array.from(
    new Set([lastSeen, firstSeen].filter((id): id is string => Boolean(id)))
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <PersonProviderIcon
          className="size-4 text-muted-foreground"
          provider={person.identityProvider}
        />
        <Badge className="text-muted-foreground" variant="outline">
          {getPersonProviderLabel(person.identityProvider)}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="Copy link"
            className="size-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onCopyLink}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon aria-hidden="true" className="size-4" icon={Link2} />
          </Button>
          {closeSlot}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <h2 className="pt-4 pb-5 font-semibold text-2xl text-foreground leading-tight tracking-tight">
          {name}
        </h2>

        <div className="flex flex-col">
          <PropertyRow
            icon={<HugeiconsIcon className={iconClass} icon={AtSign} />}
            label="Provider"
          >
            {getPersonProviderLabel(person.identityProvider)}
          </PropertyRow>
          <PropertyRow
            icon={<HugeiconsIcon className={iconClass} icon={Tag} />}
            label="Type"
          >
            {getPersonTypeLabel(person.identityType)}
          </PropertyRow>
          <PropertyRow
            icon={<HugeiconsIcon className={iconClass} icon={Hash} />}
            label="Identity"
          >
            <span className="font-mono">{person.identityValue}</span>
          </PropertyRow>
          {person.normalizedIdentityValue === person.identityValue ? null : (
            <PropertyRow
              icon={<HugeiconsIcon className={iconClass} icon={Hash} />}
              label="Normalized"
            >
              <span className="font-mono text-muted-foreground">
                {person.normalizedIdentityValue}
              </span>
            </PropertyRow>
          )}
          <PropertyRow
            icon={<HugeiconsIcon className={iconClass} icon={SignalIcon} />}
            label="Seen"
          >
            {person.seenCount} {person.seenCount === 1 ? "signal" : "signals"}
          </PropertyRow>
          {typeof metadata.confidence === "number" ? (
            <PropertyRow
              icon={<HugeiconsIcon className={iconClass} icon={Sparkles} />}
              label="Confidence"
            >
              {Math.round(metadata.confidence * 100)}%
            </PropertyRow>
          ) : null}
        </div>

        <div className="my-6 border-border/60 border-t" />

        <div className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Signals
            </h3>
            <p className="text-muted-foreground text-sm">
              Mentioned in {person.seenCount}{" "}
              {person.seenCount === 1 ? "signal" : "signals"}.
            </p>
            {signalIds.length > 0 ? (
              <div className="flex flex-col gap-2 pt-1">
                {signalIds.map((signalId) => (
                  <PersonSignalLink
                    key={signalId}
                    signalId={signalId}
                    slug={slug}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {metadata.rationale ? (
            <BodySection label="Rationale">{metadata.rationale}</BodySection>
          ) : null}
          {metadata.source ? (
            <BodySection label="Source">
              <span className="font-mono text-muted-foreground text-xs">
                {metadata.source}
              </span>
            </BodySection>
          ) : null}
        </div>
      </div>

      <div className="border-border/60 border-t px-5 py-3.5 text-muted-foreground text-xs">
        <span title={createdAt.toISOString()}>
          First seen {formatRelativeTimeToNow(createdAt, { addSuffix: true })}
        </span>
        <span aria-hidden="true">{" / "}</span>
        <span title={updatedAt.toISOString()}>
          Updated {formatRelativeTimeToNow(updatedAt, { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
