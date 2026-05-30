"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";
import { SignalBadge } from "./signals-badge";
import { SignalCreatorAvatar } from "./signals-creator-avatar";
import { SignalsEmptyState } from "./signals-empty-state";
import {
  formatSignalDate,
  formatSignalIdentifier,
  getSignalKindLabel,
  getSignalPriorityLabel,
  getSignalStatusLabel,
  getSignalSummary,
  getSignalTitle,
  type SignalListItem,
  type SignalSection,
} from "./signals-model";

const CARD_SIZE = 120;

export function SignalsBoardView({
  emptyAction,
  hasActiveSearch,
  hasAnyRows,
  onPrefetchSignal,
  onSelectSignal,
  sections,
  selectedSignalId,
}: {
  emptyAction: ReactNode;
  hasActiveSearch: boolean;
  hasAnyRows: boolean;
  onPrefetchSignal: (publicId: string) => void;
  onSelectSignal: (publicId: string) => void;
  sections: SignalSection[];
  selectedSignalId: string | null;
}) {
  if (!(hasAnyRows || hasActiveSearch)) {
    return (
      <SignalsEmptyState
        action={emptyAction}
        description="Classified signals created by API keys and automations will appear here."
        title="No classified signals yet"
      />
    );
  }

  if (!hasAnyRows && hasActiveSearch) {
    return (
      <SignalsEmptyState
        description="Try a different search or classification filter."
        title="No matching signals"
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto px-3 pb-3">
      <div className="flex min-h-full w-max gap-3">
        {sections.map((section) => (
          <SignalBoardColumn
            key={section.id}
            onPrefetchSignal={onPrefetchSignal}
            onSelectSignal={onSelectSignal}
            section={section}
            selectedSignalId={selectedSignalId}
          />
        ))}
      </div>
    </div>
  );
}

function SignalBoardColumn({
  onPrefetchSignal,
  onSelectSignal,
  section,
  selectedSignalId,
}: {
  onPrefetchSignal: (publicId: string) => void;
  onSelectSignal: (publicId: string) => void;
  section: SignalSection;
  selectedSignalId: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: section.rows.length,
    estimateSize: () => CARD_SIZE,
    getItemKey: (index) => section.rows[index]?.publicId ?? index,
    getScrollElement: () => scrollRef.current,
    overscan: 8,
  });

  return (
    <section
      aria-label={`${section.label} board column`}
      className="flex w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
    >
      <div className="flex h-9 items-center gap-2 border-border/70 border-b bg-muted/20 px-3">
        <span className="font-medium text-sm">{section.label}</span>
        <span className="text-muted-foreground text-sm">
          {section.rows.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {section.isFetching ? (
            <span className="flex items-center gap-1 text-muted-foreground/70 text-xs">
              <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              Refreshing
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto p-2"
        data-testid={`signals-board-scroll-${section.id}`}
        ref={scrollRef}
      >
        {section.isError ? (
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-muted-foreground text-sm">
              Could not load classified signals.
            </p>
            <Button
              aria-label="Retry classified signals"
              className="mt-3"
              onClick={section.refetch}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Retry
            </Button>
          </div>
        ) : section.rows.length === 0 ? (
          <SignalsEmptyState
            description={`No ${section.label.toLowerCase()} signals match this view.`}
            size="column"
            title={`No ${section.label.toLowerCase()} signals`}
          />
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const signal = section.rows[virtualItem.index];
              if (!signal) {
                return null;
              }
              return (
                <div
                  className="absolute top-0 left-0 w-full pb-2"
                  data-index={virtualItem.index}
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  <SignalBoardCard
                    isSelected={selectedSignalId === signal.publicId}
                    onPrefetch={() => onPrefetchSignal(signal.publicId)}
                    onSelect={() => onSelectSignal(signal.publicId)}
                    signal={signal}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SignalBoardCard({
  isSelected,
  onPrefetch,
  onSelect,
  signal,
}: {
  isSelected: boolean;
  onPrefetch: () => void;
  onSelect: () => void;
  signal: SignalListItem;
}) {
  const title = getSignalTitle(signal);
  const summary = getSignalSummary(signal);
  const createdAtIso = new Date(signal.createdAt).toISOString();
  const priority = signal.classification?.priority;
  const statusLabel = getSignalStatusLabel(signal.status);

  return (
    <button
      aria-pressed={isSelected}
      className={
        "w-full rounded-md border border-border/70 bg-background p-3 text-left hover:bg-muted/30" +
        (isSelected ? " bg-muted/35" : "")
      }
      onClick={onSelect}
      onFocus={onPrefetch}
      onMouseEnter={onPrefetch}
      type="button"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-muted-foreground text-xs">
          {formatSignalIdentifier(signal)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <time
            className="text-muted-foreground text-xs"
            dateTime={createdAtIso}
            title={createdAtIso}
          >
            {formatSignalDate(signal.createdAt)}
          </time>
          <SignalCreatorAvatar signal={signal} />
        </div>
      </div>
      <p className="line-clamp-2 font-medium text-foreground text-sm">{title}</p>
      {summary === title ? null : (
        <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
          {summary}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SignalBadge>
          {signal.classification?.kind
            ? getSignalKindLabel(signal.classification.kind)
            : statusLabel}
        </SignalBadge>
        {priority ? (
          <SignalBadge>{getSignalPriorityLabel(priority)}</SignalBadge>
        ) : null}
        {typeof signal.classification?.confidence === "number" ? (
          <span className="text-muted-foreground text-xs">
            {Math.round(signal.classification.confidence * 100)}%
          </span>
        ) : null}
      </div>
    </button>
  );
}
