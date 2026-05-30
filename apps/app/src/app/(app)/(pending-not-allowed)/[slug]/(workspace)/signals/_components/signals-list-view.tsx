"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
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

type ListEntry =
  | { key: string; section: SignalSection; type: "header" }
  | { key: string; section: SignalSection; type: "error" }
  | { key: string; section: SignalSection; type: "empty" }
  | { key: string; section: SignalSection; signal: SignalListItem; type: "row" };

const HEADER_SIZE = 44;
const ROW_SIZE = 44;
const STATUS_SIZE = 140;

export function SignalsListView({
  collapsedGroups,
  emptyAction,
  hasActiveSearch,
  hasAnyRows,
  onPrefetchSignal,
  onSelectSignal,
  onToggleGroup,
  sections,
  selectedSignalId,
}: {
  collapsedGroups: Record<string, boolean>;
  emptyAction: ReactNode;
  hasActiveSearch: boolean;
  hasAnyRows: boolean;
  onPrefetchSignal: (publicId: string) => void;
  onSelectSignal: (publicId: string) => void;
  onToggleGroup: (groupId: string) => void;
  sections: SignalSection[];
  selectedSignalId: string | null;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<ListEntry[]>(() => {
    const list: ListEntry[] = [];
    for (const section of sections) {
      list.push({ key: `${section.id}:header`, section, type: "header" });
      if (collapsedGroups[section.id]) {
        continue;
      }
      if (section.isError) {
        list.push({ key: `${section.id}:error`, section, type: "error" });
        continue;
      }
      if (section.rows.length === 0) {
        list.push({ key: `${section.id}:empty`, section, type: "empty" });
        continue;
      }
      for (const signal of section.rows) {
        list.push({ key: signal.publicId, section, signal, type: "row" });
      }
    }
    return list;
  }, [collapsedGroups, sections]);

  const virtualizer = useVirtualizer({
    count: entries.length,
    estimateSize: (index) => {
      const entry = entries[index];
      if (!entry || entry.type === "header") {
        return HEADER_SIZE;
      }
      if (entry.type === "row") {
        return ROW_SIZE;
      }
      return STATUS_SIZE;
    },
    getItemKey: (index) => entries[index]?.key ?? index,
    getScrollElement: () => parentRef.current,
    overscan: 12,
  });

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
    <div
      className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      data-testid="signals-list-scroll"
      ref={parentRef}
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const entry = entries[virtualItem.index];
          if (!entry) {
            return null;
          }
          return (
            <div
              className="absolute top-0 left-0 w-full"
              data-index={virtualItem.index}
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              {entry.type === "header" ? (
                <SignalListSectionHeader
                  collapsed={!!collapsedGroups[entry.section.id]}
                  onToggleGroup={onToggleGroup}
                  section={entry.section}
                />
              ) : entry.type === "error" ? (
                <div className="flex h-14 items-center justify-between rounded-md px-4">
                  <span className="text-muted-foreground text-sm">
                    Could not load {entry.section.label.toLowerCase()} signals.
                  </span>
                  <Button
                    aria-label={`Retry ${entry.section.label.toLowerCase()} signals`}
                    onClick={entry.section.refetch}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className="size-3.5"
                      data-testid="signals-list-section-retry-icon"
                    />
                    Retry
                  </Button>
                </div>
              ) : entry.type === "empty" ? (
                <SignalsEmptyState
                  description={`No ${entry.section.label.toLowerCase()} signals match this view.`}
                  size="section"
                  title={`No ${entry.section.label.toLowerCase()} signals`}
                />
              ) : (
                <div className="pt-1">
                  <SignalListRow
                    isSelected={selectedSignalId === entry.signal.publicId}
                    onPrefetch={() => onPrefetchSignal(entry.signal.publicId)}
                    onSelect={() => onSelectSignal(entry.signal.publicId)}
                    signal={entry.signal}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SignalListSectionHeader({
  collapsed,
  onToggleGroup,
  section,
}: {
  collapsed: boolean;
  onToggleGroup: (groupId: string) => void;
  section: SignalSection;
}) {
  return (
    <div
      aria-label={`${section.label} signals`}
      className="flex h-9 items-center overflow-hidden rounded-lg border border-border/60 bg-muted/25"
      role="group"
    >
      <button
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${section.label} signals`}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-4 text-left hover:bg-muted/35"
        onClick={() => onToggleGroup(section.id)}
        type="button"
      >
        {collapsed ? (
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
            data-testid="signals-list-section-toggle-icon"
          />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
            data-testid="signals-list-section-toggle-icon"
          />
        )}
        <span className="font-medium text-foreground text-sm">
          {section.label}
        </span>
        <span className="text-muted-foreground text-sm">
          {section.rows.length}
        </span>
        {section.isFetching ? (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground/70 text-xs">
            <Loader2 aria-hidden="true" className="size-3 animate-spin" />
            Refreshing
          </span>
        ) : null}
      </button>
    </div>
  );
}

function SignalListRow({
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
  const kind = signal.classification?.kind;
  const priority = signal.classification?.priority;
  const statusLabel = getSignalStatusLabel(signal.status);

  return (
    <button
      aria-pressed={isSelected}
      className={
        "group grid min-h-10 w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-4 text-left hover:bg-muted/30" +
        (isSelected ? " bg-muted/35" : " bg-background")
      }
      onClick={onSelect}
      onFocus={onPrefetch}
      onMouseEnter={onPrefetch}
      type="button"
    >
      <span className="truncate font-mono text-muted-foreground text-sm">
        {formatSignalIdentifier(signal)}
      </span>
      <span className="flex min-w-0 items-baseline gap-2 overflow-hidden">
        <span className="min-w-0 truncate font-medium text-foreground text-sm">
          {title}
        </span>
        {summary === title ? null : (
          <span className="hidden min-w-0 flex-1 truncate text-muted-foreground text-sm md:block">
            {summary}
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-muted-foreground text-sm">
        {priority ? (
          <SignalBadge className="hidden md:inline-flex">
            {getSignalPriorityLabel(priority)}
          </SignalBadge>
        ) : null}
        <SignalBadge>{kind ? getSignalKindLabel(kind) : statusLabel}</SignalBadge>
        <time
          className="w-20 shrink-0 text-right"
          dateTime={createdAtIso}
          title={createdAtIso}
        >
          {formatSignalDate(signal.createdAt)}
        </time>
        <SignalCreatorAvatar signal={signal} />
      </span>
    </button>
  );
}
