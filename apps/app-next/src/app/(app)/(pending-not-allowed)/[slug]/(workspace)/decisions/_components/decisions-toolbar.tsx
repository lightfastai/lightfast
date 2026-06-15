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
import { Input } from "@repo/ui/components/ui/input";
import { Activity, Boxes, ListFilter, Search, X } from "lucide-react";
import type { ComponentType } from "react";
import {
  type DecisionFilters,
  type DecisionProvider,
  type DecisionStatus,
  decisionProviderOptions,
  decisionStatusOptions,
  getDecisionProviderLabel,
  getDecisionStatusLabel,
} from "./decisions-model";

type FilterGroupId = "status" | "provider";
type IconComponent = ComponentType<{ className?: string }>;

interface FilterGroup {
  count: number;
  icon: IconComponent;
  id: FilterGroupId;
  label: string;
}

export function DecisionsToolbar({
  filters,
  onClearFilterGroup,
  onQueryChange,
  onToggleProvider,
  onToggleStatus,
  query,
}: {
  filters: DecisionFilters;
  onClearFilterGroup: (group: FilterGroupId) => void;
  onQueryChange: (value: string) => void;
  onToggleProvider: (value: DecisionProvider) => void;
  onToggleStatus: (value: DecisionStatus) => void;
  query: string;
}) {
  const filterGroups: FilterGroup[] = [
    {
      count: filters.statuses.length,
      id: "status",
      icon: Activity,
      label: "Status",
    },
    {
      count: filters.providers.length,
      id: "provider",
      icon: Boxes,
      label: "Provider",
    },
  ];
  const activeFilterCount = filters.statuses.length + filters.providers.length;

  return (
    <div
      className="flex shrink-0 flex-wrap items-start gap-1.5 border-border/70 border-t px-3 py-3"
      data-testid="decisions-toolbar"
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
              <ListFilter aria-hidden="true" className="size-3" />
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full border border-background bg-muted font-medium text-muted-foreground text-xs leading-none"
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
              <DecisionsFilterSubMenu
                filters={filters}
                group={group}
                key={group.id}
                onToggleProvider={onToggleProvider}
                onToggleStatus={onToggleStatus}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DecisionsFilterChip
          count={filters.statuses.length}
          icon={Activity}
          label="Status"
          onClear={() => onClearFilterGroup("status")}
          value={formatChipValue(
            filters.statuses.map((value) => getDecisionStatusLabel(value))
          )}
        />
        <DecisionsFilterChip
          count={filters.providers.length}
          icon={Boxes}
          label="Provider"
          onClear={() => onClearFilterGroup("provider")}
          value={formatChipValue(
            filters.providers.map((value) => getDecisionProviderLabel(value))
          )}
        />
      </div>

      <div className="ml-auto flex w-full min-w-0 items-center justify-end gap-1.5 sm:w-auto">
        <div className="relative w-full sm:w-56">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search decisions"
            className="pl-7"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="Search decisions"
            role="searchbox"
            size="lf-sm"
            value={query}
            variant="lf"
          />
        </div>
      </div>
    </div>
  );
}

function DecisionsFilterSubMenu({
  filters,
  group,
  onToggleProvider,
  onToggleStatus,
}: {
  filters: DecisionFilters;
  group: FilterGroup;
  onToggleProvider: (value: DecisionProvider) => void;
  onToggleStatus: (value: DecisionStatus) => void;
}) {
  const Icon = group.icon;
  const options =
    group.id === "status"
      ? decisionStatusOptions.map((option) => ({
          checked: filters.statuses.includes(option.value),
          label: option.label,
          onToggle: () => onToggleStatus(option.value),
          value: option.value as string,
        }))
      : decisionProviderOptions.map((option) => ({
          checked: filters.providers.includes(option.value),
          label: option.label,
          onToggle: () => onToggleProvider(option.value),
          value: option.value as string,
        }));

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

function DecisionsFilterChip({
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
      className="flex h-6 max-w-full shrink-0 items-center overflow-hidden rounded-lg border border-border/70 bg-muted/25 text-sm"
      onClick={onClear}
      type="button"
    >
      <span className="flex h-full shrink-0 items-center gap-2 border-border/70 border-r px-3 text-foreground">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        {label}
      </span>
      <span className="hidden h-full shrink-0 items-center border-border/70 border-r px-3 text-muted-foreground sm:flex">
        is any of
      </span>
      <span className="min-w-0 truncate px-3 text-muted-foreground">
        {value}
      </span>
      <span className="flex h-full shrink-0 items-center border-border/70 border-l px-2 text-muted-foreground hover:text-foreground">
        <X aria-hidden="true" className="size-3.5" />
      </span>
    </button>
  );
}

function formatChipValue(values: string[]) {
  if (values.length === 1) {
    return values[0]!;
  }
  return `${values.length} values`;
}
