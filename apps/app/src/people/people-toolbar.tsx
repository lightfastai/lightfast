import {
  AtSignIcon,
  Cancel01Icon,
  FilterHorizontalIcon,
  Tag01Icon,
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
  getPersonProviderLabel,
  getPersonTypeLabel,
  type PeopleClassificationFilters,
  type PersonProvider,
  type PersonType,
  peopleProviderOptions,
  peopleTypeOptions,
} from "./people-model";

type FilterGroupId = "provider" | "type";

interface FilterGroup {
  count: number;
  icon: IconSvgElement;
  id: FilterGroupId;
  label: string;
}

export function PeopleToolbar({
  filters,
  onClearFilterGroup,
  onToggleProvider,
  onToggleType,
}: {
  filters: PeopleClassificationFilters;
  onClearFilterGroup: (group: FilterGroupId) => void;
  onToggleProvider: (value: PersonProvider) => void;
  onToggleType: (value: PersonType) => void;
}) {
  const filterGroups: FilterGroup[] = [
    {
      count: filters.providers.length,
      id: "provider",
      icon: AtSignIcon,
      label: "Provider",
    },
    {
      count: filters.types.length,
      id: "type",
      icon: Tag01Icon,
      label: "Type",
    },
  ];
  const activeFilterCount = filters.providers.length + filters.types.length;

  return (
    <div
      className="flex shrink-0 flex-wrap items-start gap-1.5 border-border/70 border-t px-3 py-3"
      data-testid="people-toolbar"
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
              data-testid="people-filter-icon"
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
          icon={AtSignIcon}
          label="Provider"
          onClear={() => onClearFilterGroup("provider")}
          value={formatChipValue(
            filters.providers.map((value) => getPersonProviderLabel(value))
          )}
        />
        <PeopleFilterChip
          count={filters.types.length}
          icon={Tag01Icon}
          label="Type"
          onClear={() => onClearFilterGroup("type")}
          value={formatChipValue(
            filters.types.map((value) => getPersonTypeLabel(value))
          )}
        />
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

function PeopleFilterChip({
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

function formatChipValue(values: string[]) {
  if (values.length === 1) {
    return values[0]!;
  }
  return `${values.length} values`;
}
