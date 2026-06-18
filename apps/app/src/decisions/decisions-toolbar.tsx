import {
  Activity01Icon,
  BoxesIcon,
  Cancel01Icon,
  FilterHorizontalIcon,
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
  type DecisionFilters,
  type DecisionProvider,
  type DecisionStatus,
  decisionProviderOptions,
  decisionStatusOptions,
  getDecisionProviderLabel,
  getDecisionStatusLabel,
} from "./decisions-model";

type FilterGroupId = "status" | "provider";

interface FilterGroup {
  count: number;
  icon: IconSvgElement;
  id: FilterGroupId;
  label: string;
}

export function DecisionsToolbar({
  filters,
  onClearFilterGroup,
  onToggleProvider,
  onToggleStatus,
}: {
  filters: DecisionFilters;
  onClearFilterGroup: (group: FilterGroupId) => void;
  onToggleProvider: (value: DecisionProvider) => void;
  onToggleStatus: (value: DecisionStatus) => void;
}) {
  const filterGroups: FilterGroup[] = [
    {
      count: filters.statuses.length,
      icon: Activity01Icon,
      id: "status",
      label: "Status",
    },
    {
      count: filters.providers.length,
      icon: BoxesIcon,
      id: "provider",
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
          icon={Activity01Icon}
          label="Status"
          onClear={() => onClearFilterGroup("status")}
          value={formatChipValue(
            filters.statuses.map((value) => getDecisionStatusLabel(value))
          )}
        />
        <DecisionsFilterChip
          count={filters.providers.length}
          icon={BoxesIcon}
          label="Provider"
          onClear={() => onClearFilterGroup("provider")}
          value={formatChipValue(
            filters.providers.map((value) => getDecisionProviderLabel(value))
          )}
        />
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

function DecisionsFilterChip({
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
