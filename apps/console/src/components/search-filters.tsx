"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ActorFilter } from "./actor-filter";
import {
  AGE_PRESET_OPTIONS,
  OBSERVATION_TYPE_OPTIONS,
  SOURCE_TYPE_OPTIONS,
} from "./search-constants";

interface SearchFiltersProps {
  actorNames: string[];
  agePreset: string;
  // Content toggles
  includeContext: boolean;
  includeHighlights: boolean;
  // Pagination
  limit: number;
  observationTypes: string[];
  offset: number;
  onActorNamesChange: (names: string[]) => void;
  onAgePresetChange: (preset: string) => void;
  onIncludeContextChange: (value: boolean) => void;
  onIncludeHighlightsChange: (value: boolean) => void;
  onLimitChange: (limit: number) => void;
  onObservationTypesChange: (types: string[]) => void;
  onOffsetChange: (offset: number) => void;
  onSourceTypesChange: (types: string[]) => void;
  // For ActorFilter
  orgSlug: string;
  // Filters
  sourceTypes: string[];
  workspaceName: string;
}

export function SearchFilters({
  limit,
  onLimitChange,
  offset,
  onOffsetChange,
  includeContext,
  onIncludeContextChange,
  includeHighlights,
  onIncludeHighlightsChange,
  sourceTypes,
  onSourceTypesChange,
  observationTypes,
  onObservationTypesChange,
  actorNames,
  onActorNamesChange,
  agePreset,
  onAgePresetChange,
  orgSlug,
  workspaceName,
}: SearchFiltersProps) {
  // Local display state for number inputs to allow empty field during editing
  const [displayLimit, setDisplayLimit] = useState(String(limit));
  const [displayOffset, setDisplayOffset] = useState(String(offset));
  const [prevLimit, setPrevLimit] = useState(limit);
  const [prevOffset, setPrevOffset] = useState(offset);

  // Sync display state with prop changes (e.g., from URL updates)
  // Using setState-during-render instead of useEffect to stay React Compiler compatible
  if (prevLimit !== limit) {
    setPrevLimit(limit);
    setDisplayLimit(String(limit));
  }
  if (prevOffset !== offset) {
    setPrevOffset(offset);
    setDisplayOffset(String(offset));
  }

  // Handle limit input blur - validate and update parent
  const handleLimitBlur = () => {
    const parsed = Number.parseInt(displayLimit, 10);
    if (Number.isNaN(parsed)) {
      // Invalid (empty or non-numeric): revert to last valid value
      setDisplayLimit(String(limit));
    } else {
      // Valid number: clamp and propagate
      onLimitChange(Math.min(100, Math.max(1, parsed)));
    }
  };

  // Handle offset input blur - validate and update parent
  const handleOffsetBlur = () => {
    const parsed = Number.parseInt(displayOffset, 10);
    if (Number.isNaN(parsed)) {
      // Invalid (empty or non-numeric): revert to last valid value
      setDisplayOffset(String(offset));
    } else {
      // Valid number: ensure non-negative
      onOffsetChange(Math.max(0, parsed));
    }
  };

  return (
    <div className="space-y-12">
      {/* Pagination Settings */}
      <div>
        <h3 className="mb-6 font-medium text-muted-foreground text-xs">
          Pagination
        </h3>
        <div className="grid grid-cols-[1fr_1fr] gap-x-8 gap-y-6">
          <div>
            <Label className="font-medium text-sm">Number of Results</Label>
            <p className="mt-1 text-muted-foreground text-xs">Max: 100</p>
          </div>
          <Input
            className="input-no-spinner h-9"
            max={100}
            min={1}
            onBlur={handleLimitBlur}
            onChange={(e) => setDisplayLimit(e.target.value)}
            type="number"
            value={displayLimit}
          />

          <div>
            <Label className="font-medium text-sm">Offset</Label>
          </div>
          <Input
            className="input-no-spinner h-9"
            min={0}
            onBlur={handleOffsetBlur}
            onChange={(e) => setDisplayOffset(e.target.value)}
            type="number"
            value={displayOffset}
          />
        </div>
      </div>

      {/* Content Toggles */}
      <div>
        <h3 className="mb-6 font-medium text-muted-foreground text-xs">
          Contents
        </h3>
        <div className="grid grid-cols-[1fr_1fr] gap-x-8 gap-y-6">
          <div>
            <Label className="font-medium text-sm" htmlFor="include-context">
              Include Context
            </Label>
          </div>
          <div className="flex justify-end">
            <Switch
              checked={includeContext}
              id="include-context"
              onCheckedChange={onIncludeContextChange}
            />
          </div>

          <div>
            <Label className="font-medium text-sm" htmlFor="include-highlights">
              Highlights
            </Label>
          </div>
          <div className="flex justify-end">
            <Switch
              checked={includeHighlights}
              id="include-highlights"
              onCheckedChange={onIncludeHighlightsChange}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-6">
        <h3 className="mb-6 font-medium text-muted-foreground text-xs">
          Filters
        </h3>

        <div className="grid grid-cols-[1fr_1fr] gap-x-8 gap-y-6">
          {/* Source Types */}
          <div>
            <Label className="font-medium text-sm">Sources</Label>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="h-9 w-full justify-between font-normal"
                variant="outline"
              >
                <span className="truncate">
                  {sourceTypes.length > 0
                    ? `${sourceTypes.length} selected`
                    : "Select sources..."}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[200px] p-3">
              <div className="space-y-2">
                {SOURCE_TYPE_OPTIONS.map((opt) => (
                  <div className="flex items-center gap-2" key={opt.value}>
                    <Checkbox
                      checked={sourceTypes.includes(opt.value)}
                      id={`source-${opt.value}`}
                      onCheckedChange={(checked) => {
                        onSourceTypesChange(
                          checked
                            ? [...sourceTypes, opt.value]
                            : sourceTypes.filter((s) => s !== opt.value)
                        );
                      }}
                    />
                    <Label
                      className="cursor-pointer font-normal text-sm"
                      htmlFor={`source-${opt.value}`}
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Event Types */}
          <div>
            <Label className="font-medium text-sm">Event Types</Label>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="h-9 w-full justify-between font-normal"
                variant="outline"
              >
                <span className="truncate">
                  {observationTypes.length > 0
                    ? `${observationTypes.length} selected`
                    : "Select event types..."}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[200px] p-3">
              <div className="space-y-2">
                {OBSERVATION_TYPE_OPTIONS.map((opt) => (
                  <div className="flex items-center gap-2" key={opt.value}>
                    <Checkbox
                      checked={observationTypes.includes(opt.value)}
                      id={`observation-${opt.value}`}
                      onCheckedChange={(checked) => {
                        onObservationTypesChange(
                          checked
                            ? [...observationTypes, opt.value]
                            : observationTypes.filter((t) => t !== opt.value)
                        );
                      }}
                    />
                    <Label
                      className="cursor-pointer font-normal text-sm"
                      htmlFor={`observation-${opt.value}`}
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Actor Filter */}
          <div>
            <Label className="font-medium text-sm">Actors</Label>
          </div>
          <ActorFilter
            onSelectionChange={onActorNamesChange}
            orgSlug={orgSlug}
            selectedActors={actorNames}
            workspaceName={workspaceName}
          />

          {/* Max Content Age */}
          <div>
            <Label className="font-medium text-sm">Max Content Age</Label>
          </div>
          <Select
            onValueChange={(value) =>
              onAgePresetChange(
                value as "1h" | "6h" | "24h" | "72h" | "7d" | "30d" | "none"
              )
            }
            value={agePreset}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_PRESET_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
