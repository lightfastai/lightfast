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
import {
  AtSign,
  ListFilter,
  Search,
  Tag,
  UserCheck,
  UsersRound,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  getMemberStatusLabel,
  getPersonProviderLabel,
  getPersonSourceLabel,
  getPersonTypeLabel,
  type PeopleClassificationFilters,
  type PersonMemberStatus,
  type PersonProvider,
  type PersonSource,
  type PersonType,
  peopleMemberStatusOptions,
  peopleProviderOptions,
  peopleSourceOptions,
  peopleTypeOptions,
} from "./people-model";

type FilterGroupId = "provider" | "type" | "source" | "memberStatus";
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
  onToggleMemberStatus,
  onQueryChange,
  onToggleProvider,
  onToggleSource,
  onToggleType,
  query,
}: {
  filters: PeopleClassificationFilters;
  onClearFilterGroup: (group: FilterGroupId) => void;
  onToggleMemberStatus: (value: PersonMemberStatus) => void;
  onQueryChange: (value: string) => void;
  onToggleProvider: (value: PersonProvider) => void;
  onToggleSource: (value: PersonSource) => void;
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
    {
      count: filters.sources.length,
      id: "source",
      icon: UsersRound,
      label: "Source",
    },
    {
      count: filters.memberStatuses.length,
      id: "memberStatus",
      icon: UserCheck,
      label: "Member Status",
    },
  ];
  const activeFilterCount =
    filters.providers.length +
    filters.types.length +
    filters.sources.length +
    filters.memberStatuses.length;

  return (
    <div
      className="flex shrink-0 flex-wrap items-start gap-1.5 border-border/70 border-t px-3 py-3"
      data-testid="people-toolbar"
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
                data-testid="people-filter-icon"
              />
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
              <PeopleFilterSubMenu
                filters={filters}
                group={group}
                key={group.id}
                onToggleMemberStatus={onToggleMemberStatus}
                onToggleProvider={onToggleProvider}
                onToggleSource={onToggleSource}
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
        <PeopleFilterChip
          count={filters.sources.length}
          icon={UsersRound}
          label="Source"
          onClear={() => onClearFilterGroup("source")}
          value={formatChipValue(
            filters.sources.map((value) => getPersonSourceLabel(value))
          )}
        />
        <PeopleFilterChip
          count={filters.memberStatuses.length}
          icon={UserCheck}
          label="Member Status"
          onClear={() => onClearFilterGroup("memberStatus")}
          value={formatChipValue(
            filters.memberStatuses.map((value) => getMemberStatusLabel(value))
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
            aria-label="Search people"
            className="pl-7"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="Search people"
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

function PeopleFilterSubMenu({
  filters,
  group,
  onToggleMemberStatus,
  onToggleProvider,
  onToggleSource,
  onToggleType,
}: {
  filters: PeopleClassificationFilters;
  group: FilterGroup;
  onToggleMemberStatus: (value: PersonMemberStatus) => void;
  onToggleProvider: (value: PersonProvider) => void;
  onToggleSource: (value: PersonSource) => void;
  onToggleType: (value: PersonType) => void;
}) {
  const Icon = group.icon;
  const options = getFilterOptions({
    filters,
    groupId: group.id,
    onToggleMemberStatus,
    onToggleProvider,
    onToggleSource,
    onToggleType,
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

function getFilterOptions({
  filters,
  groupId,
  onToggleMemberStatus,
  onToggleProvider,
  onToggleSource,
  onToggleType,
}: {
  filters: PeopleClassificationFilters;
  groupId: FilterGroupId;
  onToggleMemberStatus: (value: PersonMemberStatus) => void;
  onToggleProvider: (value: PersonProvider) => void;
  onToggleSource: (value: PersonSource) => void;
  onToggleType: (value: PersonType) => void;
}): {
  checked: boolean;
  label: string;
  onToggle: () => void;
  value: string;
}[] {
  if (groupId === "provider") {
    return peopleProviderOptions.map((option) => ({
      checked: filters.providers.includes(option.value),
      label: option.label,
      onToggle: () => onToggleProvider(option.value),
      value: option.value,
    }));
  }
  if (groupId === "type") {
    return peopleTypeOptions.map((option) => ({
      checked: filters.types.includes(option.value),
      label: option.label,
      onToggle: () => onToggleType(option.value),
      value: option.value,
    }));
  }
  if (groupId === "source") {
    return peopleSourceOptions.map((option) => ({
      checked: filters.sources.includes(option.value),
      label: option.label,
      onToggle: () => onToggleSource(option.value),
      value: option.value,
    }));
  }
  return peopleMemberStatusOptions.map((option) => ({
    checked: filters.memberStatuses.includes(option.value),
    label: option.label,
    onToggle: () => onToggleMemberStatus(option.value),
    value: option.value,
  }));
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
