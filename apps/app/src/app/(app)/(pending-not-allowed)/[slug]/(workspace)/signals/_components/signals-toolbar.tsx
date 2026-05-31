"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Flag, ListFilter, Tag, UserRoundCheck, X } from "lucide-react";
import type { ComponentType } from "react";
import {
  getSignalDispositionLabel,
  getSignalKindLabel,
  getSignalPriorityLabel,
  type SignalClassificationFilters,
  type SignalDisposition,
  type SignalKind,
  type SignalPriority,
  signalDispositionOptions,
  signalKindOptions,
  signalPriorityOptions,
} from "./signals-model";

type FilterGroupId = "disposition" | "kind" | "people" | "priority";
type IconComponent = ComponentType<{ className?: string }>;

interface FilterGroup {
  count: number;
  icon: IconComponent;
  id: FilterGroupId;
  label: string;
}

interface FilterValueOption {
  checked: boolean;
  label: string;
  onToggle: () => void;
  value: string;
}

export function SignalsToolbar({
  filters,
  onAddSignal,
  onClearFilterGroup,
  onPeopleRoutedChange,
  onToggleDisposition,
  onToggleKind,
  onTogglePriority,
}: {
  filters: SignalClassificationFilters;
  onAddSignal: () => void;
  onClearFilterGroup: (
    group: "disposition" | "kind" | "people" | "priority"
  ) => void;
  onPeopleRoutedChange: (value: boolean) => void;
  onToggleDisposition: (value: SignalDisposition) => void;
  onToggleKind: (value: SignalKind) => void;
  onTogglePriority: (value: SignalPriority) => void;
}) {
  const filterGroups: FilterGroup[] = [
    {
      count: filters.kinds.length,
      id: "kind",
      icon: Tag,
      label: "Kind",
    },
    {
      count: filters.priorities.length,
      id: "priority",
      icon: Flag,
      label: "Priority",
    },
    {
      count: filters.dispositions.length,
      id: "disposition",
      icon: ListFilter,
      label: "Disposition",
    },
    {
      count: filters.peopleRouted ? 1 : 0,
      id: "people",
      icon: UserRoundCheck,
      label: "People routing",
    },
  ];
  const activeFilterCount =
    filters.kinds.length +
    filters.priorities.length +
    filters.dispositions.length +
    (filters.peopleRouted ? 1 : 0);

  return (
    <div
      className="flex shrink-0 flex-wrap items-start gap-1.5 border-border/70 border-t px-3 py-3"
      data-testid="signals-toolbar"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Filters"
              className="relative size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              size="icon-sm"
              title="Filters"
              type="button"
              variant="ghost"
            >
              <ListFilter
                aria-hidden="true"
                className="size-3"
                data-testid="signals-filter-icon"
              />
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full border border-background bg-muted font-medium text-[0.55rem] text-muted-foreground leading-none"
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 overflow-visible"
            sideOffset={8}
          >
            {filterGroups.map((group) => (
              <FilterSubMenu
                filters={filters}
                group={group}
                key={group.id}
                onPeopleRoutedChange={onPeopleRoutedChange}
                onToggleDisposition={onToggleDisposition}
                onToggleKind={onToggleKind}
                onTogglePriority={onTogglePriority}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <FilterChip
          count={filters.kinds.length}
          icon={Tag}
          label="Kind"
          onClear={() => onClearFilterGroup("kind")}
          value={formatChipValue(
            filters.kinds.map((value) => getSignalKindLabel(value))
          )}
        />
        <FilterChip
          count={filters.priorities.length}
          icon={Flag}
          label="Priority"
          onClear={() => onClearFilterGroup("priority")}
          value={formatChipValue(
            filters.priorities.map((value) => getSignalPriorityLabel(value))
          )}
        />
        <FilterChip
          count={filters.dispositions.length}
          icon={ListFilter}
          label="Disposition"
          onClear={() => onClearFilterGroup("disposition")}
          value={formatChipValue(
            filters.dispositions.map((value) =>
              getSignalDispositionLabel(value)
            )
          )}
        />
        <FilterChip
          count={filters.peopleRouted ? 1 : 0}
          icon={UserRoundCheck}
          label="People routing"
          onClear={() => onClearFilterGroup("people")}
          value="Routed"
        />
      </div>

      <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
        <Button
          className="h-6 rounded-lg border border-border/70 bg-muted/30 px-2.5 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
          onClick={onAddSignal}
          size="sm"
          type="button"
          variant="ghost"
        >
          Add Signal
        </Button>
      </div>
    </div>
  );
}

function FilterSubMenu({
  filters,
  group,
  onPeopleRoutedChange,
  onToggleDisposition,
  onToggleKind,
  onTogglePriority,
}: {
  filters: SignalClassificationFilters;
  group: FilterGroup;
  onPeopleRoutedChange: (value: boolean) => void;
  onToggleDisposition: (value: SignalDisposition) => void;
  onToggleKind: (value: SignalKind) => void;
  onTogglePriority: (value: SignalPriority) => void;
}) {
  const Icon = group.icon;
  const options = getFilterValueOptions({
    activeFilter: group.id,
    filters,
    onPeopleRoutedChange,
    onToggleDisposition,
    onToggleKind,
    onTogglePriority,
  });

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        {group.count > 0 ? (
          <span className="rounded bg-muted px-1.5 text-muted-foreground text-xs">
            {group.count}
          </span>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        <DropdownMenuLabel className="flex h-7 items-center gap-2 text-muted-foreground text-xs">
          <Icon aria-hidden="true" className="size-3.5" />
          <span>{group.label}</span>
          <span className="ml-auto">is any of</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            checked={option.checked}
            key={option.value}
            onCheckedChange={option.onToggle}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function FilterChip({
  count,
  icon: Icon,
  label,
  onClear,
  value,
}: {
  count: number;
  icon: IconComponent;
  label: string;
  onClear: () => void;
  value: string;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      className="flex h-6 shrink-0 items-center overflow-hidden rounded-lg border border-border/70 bg-muted/25 text-sm"
      onClick={onClear}
      type="button"
    >
      <span className="flex h-full items-center gap-2 border-border/70 border-r px-3 text-foreground">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        {label}
      </span>
      <span className="flex h-full items-center border-border/70 border-r px-3 text-muted-foreground">
        is any of
      </span>
      <span className="flex h-full items-center px-3 text-muted-foreground">
        {value}
      </span>
      <span className="flex h-full items-center border-border/70 border-l px-2 text-muted-foreground hover:text-foreground">
        <X aria-hidden="true" className="size-3.5" />
      </span>
    </button>
  );
}

function getFilterValueOptions({
  activeFilter,
  filters,
  onPeopleRoutedChange,
  onToggleDisposition,
  onToggleKind,
  onTogglePriority,
}: {
  activeFilter: FilterGroupId;
  filters: SignalClassificationFilters;
  onPeopleRoutedChange: (value: boolean) => void;
  onToggleDisposition: (value: SignalDisposition) => void;
  onToggleKind: (value: SignalKind) => void;
  onTogglePriority: (value: SignalPriority) => void;
}): FilterValueOption[] {
  if (activeFilter === "kind") {
    return signalKindOptions.map((option) => ({
      checked: filters.kinds.includes(option.value),
      label: option.label,
      onToggle: () => onToggleKind(option.value),
      value: option.value,
    }));
  }

  if (activeFilter === "priority") {
    return signalPriorityOptions.map((option) => ({
      checked: filters.priorities.includes(option.value),
      label: option.label,
      onToggle: () => onTogglePriority(option.value),
      value: option.value,
    }));
  }

  if (activeFilter === "disposition") {
    return signalDispositionOptions.map((option) => ({
      checked: filters.dispositions.includes(option.value),
      label: option.label,
      onToggle: () => onToggleDisposition(option.value),
      value: option.value,
    }));
  }

  return [
    {
      checked: filters.peopleRouted,
      label: "Routed",
      onToggle: () => onPeopleRoutedChange(!filters.peopleRouted),
      value: "routed",
    },
  ];
}

function formatChipValue(values: string[]) {
  if (values.length === 1) {
    return values[0]!;
  }
  return `${values.length} values`;
}
