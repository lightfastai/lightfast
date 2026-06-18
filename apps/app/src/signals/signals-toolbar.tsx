import {
  Cancel01Icon,
  CheckListIcon,
  FilterHorizontalIcon,
  Flag01Icon,
  Tag01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
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

interface FilterGroup {
  count: number;
  icon: IconSvgElement;
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
  onClearFilterGroup,
  onPeopleRoutedChange,
  onToggleDisposition,
  onToggleKind,
  onTogglePriority,
}: {
  filters: SignalClassificationFilters;
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
      icon: Tag01Icon,
      label: "Kind",
    },
    {
      count: filters.priorities.length,
      id: "priority",
      icon: Flag01Icon,
      label: "Priority",
    },
    {
      count: filters.dispositions.length,
      id: "disposition",
      icon: CheckListIcon,
      label: "Disposition",
    },
    {
      count: filters.peopleRouted ? 1 : 0,
      id: "people",
      icon: UserCheck01Icon,
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
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={
                  activeFilterCount > 0
                    ? `${activeFilterCount} active filters`
                    : "Filters"
                }
                size={activeFilterCount > 0 ? "xs" : "icon-xs"}
                title="Filters"
                type="button"
                variant="outline"
              />
            }
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              data-testid="signals-filter-icon"
              icon={FilterHorizontalIcon}
            />
            {activeFilterCount > 0 ? (
              <span aria-hidden="true">{activeFilterCount}</span>
            ) : null}
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
          icon={Tag01Icon}
          label="Kind"
          onClear={() => onClearFilterGroup("kind")}
          value={formatChipValue(
            filters.kinds.map((value) => getSignalKindLabel(value))
          )}
        />
        <FilterChip
          count={filters.priorities.length}
          icon={Flag01Icon}
          label="Priority"
          onClear={() => onClearFilterGroup("priority")}
          value={formatChipValue(
            filters.priorities.map((value) => getSignalPriorityLabel(value))
          )}
        />
        <FilterChip
          count={filters.dispositions.length}
          icon={CheckListIcon}
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
          icon={UserCheck01Icon}
          label="People routing"
          onClear={() => onClearFilterGroup("people")}
          value="Routed"
        />
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
        <HugeiconsIcon aria-hidden="true" icon={group.icon} />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        {group.count > 0 ? (
          <span className="rounded bg-muted px-1.5 text-muted-foreground text-xs">
            {group.count}
          </span>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex h-7 items-center gap-2 text-muted-foreground text-xs">
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3.5"
              icon={group.icon}
            />
            <span>{group.label}</span>
            <span className="ml-auto">is any of</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              checked={option.checked}
              closeOnClick={false}
              key={option.value}
              onCheckedChange={option.onToggle}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function FilterChip({
  count,
  icon,
  label,
  onClear,
  value,
}: {
  count: number;
  icon: IconSvgElement;
  label: string;
  onClear: () => void;
  value: string;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <Button
      aria-label={`Clear ${label} filter`}
      onClick={onClear}
      size="xs"
      title={`Clear ${label} filter`}
      type="button"
      variant="outline"
    >
      <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={icon} />
      <span>{label}</span>
      <span>is any of</span>
      <span>{value}</span>
      <HugeiconsIcon
        aria-hidden="true"
        data-icon="inline-end"
        icon={Cancel01Icon}
      />
    </Button>
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
