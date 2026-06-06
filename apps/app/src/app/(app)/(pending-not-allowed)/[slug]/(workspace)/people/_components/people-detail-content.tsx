"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  AtSign,
  Clock3,
  Hash,
  Link2,
  Signal as SignalIcon,
  Sparkles,
  Tag,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTRPC } from "~/trpc/react";
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
  const trpc = useTRPC();
  const query = useQuery(
    trpc.org.workspace.signals.get.queryOptions(
      { publicId: signalId },
      { enabled: Boolean(signalId) }
    )
  );
  const title = query.data
    ? (query.data.classification?.title ?? query.data.input)
    : null;

  return (
    <Link
      className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 hover:bg-muted/30"
      href={`/${slug}/signals?signal=${signalId}`}
    >
      <SignalIcon
        aria-hidden="true"
        className="size-3.5 text-muted-foreground"
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
            <Link2 aria-hidden="true" className="size-4" />
          </Button>
          {closeSlot}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <h2 className="pt-4 pb-5 font-semibold text-2xl text-foreground leading-tight tracking-tight">
          {name}
        </h2>

        <div className="flex flex-col">
          <PropertyRow icon={<AtSign className={iconClass} />} label="Provider">
            {getPersonProviderLabel(person.identityProvider)}
          </PropertyRow>
          <PropertyRow icon={<Tag className={iconClass} />} label="Type">
            {getPersonTypeLabel(person.identityType)}
          </PropertyRow>
          <PropertyRow icon={<Hash className={iconClass} />} label="Identity">
            <span className="font-mono">{person.identityValue}</span>
          </PropertyRow>
          {person.normalizedIdentityValue === person.identityValue ? null : (
            <PropertyRow
              icon={<Hash className={iconClass} />}
              label="Normalized"
            >
              <span className="font-mono text-muted-foreground">
                {person.normalizedIdentityValue}
              </span>
            </PropertyRow>
          )}
          {person.memberStatus ? (
            <PropertyRow
              icon={<UserCheck className={iconClass} />}
              label="Member"
            >
              {person.memberStatus === "active"
                ? "Team member"
                : "Former member"}
            </PropertyRow>
          ) : null}
          {person.memberRole ? (
            <PropertyRow icon={<Tag className={iconClass} />} label="Role">
              {person.memberRole === "org:admin" ? "Admin" : "Member"}
            </PropertyRow>
          ) : null}
          {person.memberSyncedAt ? (
            <PropertyRow icon={<Clock3 className={iconClass} />} label="Synced">
              {formatRelativeTimeToNow(new Date(person.memberSyncedAt), {
                addSuffix: true,
              })}
            </PropertyRow>
          ) : null}
          <PropertyRow icon={<SignalIcon className={iconClass} />} label="Seen">
            {person.seenCount} {person.seenCount === 1 ? "signal" : "signals"}
          </PropertyRow>
          {typeof metadata.confidence === "number" ? (
            <PropertyRow
              icon={<Sparkles className={iconClass} />}
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
        <span aria-hidden="true"> · </span>
        <span title={updatedAt.toISOString()}>
          Updated {formatRelativeTimeToNow(updatedAt, { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
