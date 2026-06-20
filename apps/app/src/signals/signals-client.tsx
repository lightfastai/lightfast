import { getSignal } from "@api/app/tanstack/signals";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui-v2/components/ui/button";
import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { SignalCreateDialog } from "./signal-create-dialog";
import { SignalDetailSheet } from "./signal-detail-sheet";
import { SignalsListView } from "./signals-list-view";
import { SignalsLoading } from "./signals-loading";
import type { SignalClassificationFilters } from "./signals-model";
import {
  type NormalizedSignalsSearch,
  parseSignalDispositions,
  parseSignalKinds,
  parseSignalPriorities,
  serializeSignalValues,
  toggleSignalValue,
} from "./signals-search-params";
import { SignalsToolbar } from "./signals-toolbar";
import { SignalsTruncationBanner } from "./signals-truncation-banner";
import { useSignalsUiStore } from "./signals-ui-store";
import { SignalsViewSwitcher } from "./signals-view-switcher";
import { useSignalsWorkspaceData } from "./use-signals-workspace-data";

export function SignalsClient({
  search,
  setSearchParams,
}: {
  search: NormalizedSignalsSearch;
  setSearchParams: (updates: Partial<NormalizedSignalsSearch>) => void;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const openCreateSignal = useCallback(() => setCreateOpen(true), []);

  const collapsedGroups = useSignalsUiStore(
    (state) => state.collapsedListGroups
  );
  const toggleListGroup = useSignalsUiStore((state) => state.toggleListGroup);

  const filters = useMemo<SignalClassificationFilters>(
    () => ({
      dispositions: parseSignalDispositions(search.disposition),
      kinds: parseSignalKinds(search.kind),
      peopleRouted: search.people === "routed",
      priorities: parseSignalPriorities(search.priority),
    }),
    [search.disposition, search.kind, search.people, search.priority]
  );
  const hasActiveFilters =
    filters.dispositions.length > 0 ||
    filters.kinds.length > 0 ||
    filters.peopleRouted ||
    filters.priorities.length > 0;

  // The toolbar reflects `filters` immediately; the (cheap) list work runs on the
  // deferred value so a rapid toggle never drops a frame. With virtualized views
  // the in-memory work is trivial — this is the single hedge for the tail case.
  const deferredFilters = useDeferredValue(filters);

  const {
    hasAnyRows,
    isInitialPending,
    limit,
    signalsByPublicId,
    truncated,
    visibleListSections,
    windowDays,
  } = useSignalsWorkspaceData({ filters: deferredFilters });

  const prefetchSignal = useCallback(
    (publicId: string) => {
      const cached = signalsByPublicId.get(publicId);
      if (cached && "input" in cached) {
        return; // processing/full rows already carry the body
      }
      void queryClient.prefetchQuery({
        queryFn: () => getSignal({ data: { publicId } }),
        queryKey: ["signals", "detail", publicId] as const,
      });
    },
    [queryClient, signalsByPublicId]
  );

  const emptyCreateAction = <SignalAddButton onClick={openCreateSignal} />;

  if (isInitialPending) {
    return (
      <WorkspaceSurface
        className="flex min-h-full flex-col bg-background"
        variant="flush"
      >
        <h1 className="sr-only">Signals</h1>
        <SignalsLoading />
      </WorkspaceSurface>
    );
  }

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">Signals</h1>
      <SignalsViewHeader onAddSignal={openCreateSignal}>
        <SignalsViewSwitcher
          search={search}
          setSearchParams={setSearchParams}
        />
      </SignalsViewHeader>
      <SignalsToolbar
        filters={filters}
        onClearFilterGroup={(group) => {
          if (group === "disposition") {
            setSearchParams({ disposition: "", view: null });
          } else if (group === "kind") {
            setSearchParams({ kind: "", view: null });
          } else if (group === "people") {
            setSearchParams({ people: "all", view: null });
          } else {
            setSearchParams({ priority: "", view: null });
          }
        }}
        onPeopleRoutedChange={(value) => {
          setSearchParams({ people: value ? "routed" : "all", view: null });
        }}
        onToggleDisposition={(value) => {
          setSearchParams({
            disposition: serializeSignalValues(
              toggleSignalValue(filters.dispositions, value)
            ),
            view: null,
          });
        }}
        onToggleKind={(value) => {
          setSearchParams({
            kind: serializeSignalValues(
              toggleSignalValue(filters.kinds, value)
            ),
            view: null,
          });
        }}
        onTogglePriority={(value) => {
          setSearchParams({
            priority: serializeSignalValues(
              toggleSignalValue(filters.priorities, value)
            ),
            view: null,
          });
        }}
      />

      <SignalsTruncationBanner
        limit={limit}
        truncated={truncated}
        windowDays={windowDays}
      />

      <SignalsListView
        collapsedGroups={collapsedGroups}
        emptyAction={emptyCreateAction}
        hasActiveSearch={hasActiveFilters}
        hasAnyRows={hasAnyRows}
        onPrefetchSignal={prefetchSignal}
        onSelectSignal={(publicId) => setSearchParams({ signal: publicId })}
        onToggleGroup={toggleListGroup}
        sections={visibleListSections}
        selectedSignalId={search.signal}
      />

      <SignalDetailSheet
        initialItem={
          search.signal ? signalsByPublicId.get(search.signal) : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams({ signal: null });
          }
        }}
        publicId={search.signal}
      />
      <SignalCreateDialog onOpenChange={setCreateOpen} open={createOpen} />
    </WorkspaceSurface>
  );
}

function SignalsViewHeader({
  children,
  onAddSignal,
}: {
  children: ReactNode;
  onAddSignal: () => void;
}) {
  return (
    <header
      className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-3"
      data-testid="signals-view-header"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <SidebarTrigger className="size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
        <div className="flex min-w-[12rem] flex-1 items-center overflow-hidden">
          {children}
        </div>
      </div>
      <SignalAddButton onClick={onAddSignal} />
    </header>
  );
}

function SignalAddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} size="xs" type="button" variant="outline">
      <HugeiconsIcon
        aria-hidden="true"
        data-icon="inline-start"
        icon={Add01Icon}
      />
      <span>Add Signal</span>
    </Button>
  );
}
