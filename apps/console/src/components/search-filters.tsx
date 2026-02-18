"use client";

import { useState, useEffect } from "react";
import { Input } from "@repo/ui/components/ui/input";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Switch } from "@repo/ui/components/ui/switch";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { Button } from "@repo/ui/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  SOURCE_TYPE_OPTIONS,
  OBSERVATION_TYPE_OPTIONS,
  AGE_PRESET_OPTIONS,
} from "./search-constants";
import { ActorFilter } from "./actor-filter";

interface SearchFiltersProps {
  // Pagination
  limit: number;
  onLimitChange: (limit: number) => void;
  offset: number;
  onOffsetChange: (offset: number) => void;
  // Content toggles
  includeContext: boolean;
  onIncludeContextChange: (value: boolean) => void;
  includeHighlights: boolean;
  onIncludeHighlightsChange: (value: boolean) => void;
  // Filters
  sourceTypes: string[];
  onSourceTypesChange: (types: string[]) => void;
  observationTypes: string[];
  onObservationTypesChange: (types: string[]) => void;
  actorNames: string[];
  onActorNamesChange: (names: string[]) => void;
  agePreset: string;
  onAgePresetChange: (preset: string) => void;
  // For ActorFilter
  orgSlug: string;
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

  // Sync display state with prop changes (e.g., from URL updates)
  useEffect(() => {
    setDisplayLimit(String(limit));
    setDisplayOffset(String(offset));
  }, [limit, offset]);

  // Handle limit input blur - validate and update parent
  const handleLimitBlur = () => {
    const parsed = parseInt(displayLimit, 10);
    if (!isNaN(parsed)) {
      // Valid number: clamp and propagate
      onLimitChange(Math.min(100, Math.max(1, parsed)));
    } else {
      // Invalid (empty or non-numeric): revert to last valid value
      setDisplayLimit(String(limit));
    }
  };

  // Handle offset input blur - validate and update parent
  const handleOffsetBlur = () => {
    const parsed = parseInt(displayOffset, 10);
    if (!isNaN(parsed)) {
      // Valid number: ensure non-negative
      onOffsetChange(Math.max(0, parsed));
    } else {
      // Invalid (empty or non-numeric): revert to last valid value
      setDisplayOffset(String(offset));
    }
  };

  return (
    <div className="space-y-12">
      {/* Pagination Settings */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-6">Pagination</h3>
        <div className="grid grid-cols-[1fr_1fr] gap-x-8 gap-y-6">
        <div>
          <Label className="text-sm font-medium">Number of Results</Label>
          <p className="text-xs text-muted-foreground mt-1">Max: 100</p>
        </div>
        <Input
          type="number"
          min={1}
          max={100}
          value={displayLimit}
          onChange={(e) => setDisplayLimit(e.target.value)}
          onBlur={handleLimitBlur}
          className="h-9 input-no-spinner"
        />

        <div>
          <Label className="text-sm font-medium">Offset</Label>
        </div>
        <Input
          type="number"
          min={0}
          value={displayOffset}
          onChange={(e) => setDisplayOffset(e.target.value)}
          onBlur={handleOffsetBlur}
          className="h-9 input-no-spinner"
        />
        </div>
      </div>

      {/* Content Toggles */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-6">Contents</h3>
        <div className="grid grid-cols-[1fr_1fr] gap-x-8 gap-y-6">
          <div>
            <Label htmlFor="include-context" className="text-sm font-medium">
              Include Context
            </Label>
          </div>
          <div className="flex justify-end">
            <Switch
              id="include-context"
              checked={includeContext}
              onCheckedChange={onIncludeContextChange}
            />
          </div>

          <div>
            <Label htmlFor="include-highlights" className="text-sm font-medium">
              Highlights
            </Label>
          </div>
          <div className="flex justify-end">
            <Switch
              id="include-highlights"
              checked={includeHighlights}
              onCheckedChange={onIncludeHighlightsChange}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-6">
        <h3 className="text-xs font-medium text-muted-foreground mb-6">Filters</h3>

        <div className="grid grid-cols-[1fr_1fr] gap-x-8 gap-y-6">
          {/* Source Types */}
          <div>
            <Label className="text-sm font-medium">Sources</Label>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-full justify-between font-normal"
              >
                <span className="truncate">
                  {sourceTypes.length > 0
                    ? `${sourceTypes.length} selected`
                    : "Select sources..."}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-3" align="start">
              <div className="space-y-2">
                {SOURCE_TYPE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`source-${opt.value}`}
                      checked={sourceTypes.includes(opt.value)}
                      onCheckedChange={(checked) => {
                        onSourceTypesChange(
                          checked
                            ? [...sourceTypes, opt.value]
                            : sourceTypes.filter((s) => s !== opt.value),
                        );
                      }}
                    />
                    <Label
                      htmlFor={`source-${opt.value}`}
                      className="text-sm font-normal cursor-pointer"
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
            <Label className="text-sm font-medium">Event Types</Label>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-full justify-between font-normal"
              >
                <span className="truncate">
                  {observationTypes.length > 0
                    ? `${observationTypes.length} selected`
                    : "Select event types..."}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-3" align="start">
              <div className="space-y-2">
                {OBSERVATION_TYPE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`observation-${opt.value}`}
                      checked={observationTypes.includes(opt.value)}
                      onCheckedChange={(checked) => {
                        onObservationTypesChange(
                          checked
                            ? [...observationTypes, opt.value]
                            : observationTypes.filter((t) => t !== opt.value),
                        );
                      }}
                    />
                    <Label
                      htmlFor={`observation-${opt.value}`}
                      className="text-sm font-normal cursor-pointer"
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
            <Label className="text-sm font-medium">Actors</Label>
          </div>
          <ActorFilter
            orgSlug={orgSlug}
            workspaceName={workspaceName}
            selectedActors={actorNames}
            onSelectionChange={onActorNamesChange}
          />

          {/* Max Content Age */}
          <div>
            <Label className="text-sm font-medium">Max Content Age</Label>
          </div>
          <Select
            value={agePreset}
            onValueChange={(value) =>
              onAgePresetChange(
                value as "1h" | "6h" | "24h" | "72h" | "7d" | "30d" | "none",
              )
            }
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
