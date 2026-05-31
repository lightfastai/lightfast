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
import { AtSign, ListFilter, Search, Tag, X } from "lucide-react";
import type { ComponentType } from "react";
import {
  getPersonProviderLabel,
  getPersonTypeLabel,
  type PeopleClassificationFilters,
  type PersonProvider,
  type PersonType,
  peopleProviderOptions,
  peopleTypeOptions,
} from "./people-model";

type FilterGroupId = "provider" | "type";
type IconComponent = ComponentType<{ className?: string }>;

interface FilterGroup {
  count: number;
  icon: IconComponent;
  id: FilterGroupId;
  label: string;
}

export function PeopleToolbar({
  filters,
  onClearFilterGroup,
  onQueryChange,
  onToggleProvider,
  onToggleType,
  query,
}: {
  filters: PeopleClassificationFilters;
  onClearFilterGroup: (group: FilterGroupId) => void;
  onQueryChange: (value: string) => void;
  onToggleProvider: (value: PersonProvider) => void;
  onToggleType: (value: PersonType) => void;
  query: string;
}) {
  const filterGroups: FilterGroup[] = [
    {
      count: filters.providers.length,
      id: "provider",
      icon: AtSign,
      label: "Provider",
    },
    {
      count: filters.types.length,
      id: "type",
      icon: Tag,
      label: "Type",
    },
  ];
  const activeFilterCount = filters.providers.length + filters.types.length;

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1.5 border-border/70 border-t px-3 py-3"
      data-testid="people-toolbar"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
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
                data-testid="people-filter-icon"
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
              <PeopleFilterSubMenu
                filters={filters}
                group={group}
                key={group.id}
                onToggleProvider={onToggleProvider}
                onToggleType={onToggleType}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <PeopleFilterChip
          count={filters.providers.length}
          icon={AtSign}
          label="Provider"
          onClear={() => onClearFilterGroup("provider")}
          value={formatChipValue(
            filters.providers.map((value) => getPersonProviderLabel(value))
          )}
        />
        <PeopleFilterChip
          count={filters.types.length}
          icon={Tag}
          label="Type"
          onClear={() => onClearFilterGroup("type")}
          value={formatChipValue(
            filters.types.map((value) => getPersonTypeLabel(value))
          )}
        />
      </div>

      <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
        <div className="flex h-6 w-56 items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2 text-muted-foreground">
          <Search aria-hidden="true" className="size-3" />
          <Input
            aria-label="Search people"
            className="h-5 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="Search people"
            role="searchbox"
            value={query}
          />
        </div>
      </div>
    </div>
  );
}

function PeopleFilterSubMenu({
  filters,
  group,
  onToggleProvider,
  onToggleType,
}: {
  filters: PeopleClassificationFilters;
  group: FilterGroup;
  onToggleProvider: (value: PersonProvider) => void;
  onToggleType: (value: PersonType) => void;
}) {
  const Icon = group.icon;
  const options =
    group.id === "provider"
      ? peopleProviderOptions.map((option) => ({
          checked: filters.providers.includes(option.value),
          label: option.label,
          onToggle: () => onToggleProvider(option.value),
          value: option.value as string,
        }))
      : peopleTypeOptions.map((option) => ({
          checked: filters.types.includes(option.value),
          label: option.label,
          onToggle: () => onToggleType(option.value),
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

function PeopleFilterChip({
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

function formatChipValue(values: string[]) {
  if (values.length === 1) {
    return values[0]!;
  }
  return `${values.length} values`;
}
