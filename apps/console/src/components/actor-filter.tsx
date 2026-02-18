"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { Input } from "@repo/ui/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { ChevronDown } from "lucide-react";

interface ActorFilterProps {
  orgSlug: string;
  workspaceName: string;
  selectedActors: string[];
  onSelectionChange: (actors: string[]) => void;
}

export function ActorFilter({
  orgSlug,
  workspaceName,
  selectedActors,
  onSelectionChange,
}: ActorFilterProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input so each keystroke doesn't fire a new network request
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: actors } = useQuery({
    ...trpc.workspace.getActors.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName: workspaceName,
      search: debouncedSearch || undefined,
      limit: 50,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000, // 1 minute
  });

  const toggleActor = (displayName: string) => {
    if (selectedActors.includes(displayName)) {
      onSelectionChange(selectedActors.filter((a) => a !== displayName));
    } else {
      onSelectionChange([...selectedActors, displayName]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedActors.length > 0
              ? `${selectedActors.length} selected`
              : "Select actors..."}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-3" align="start">
        <div className="space-y-3">
          <Input
            placeholder="Search actors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {!actors || actors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                {search ? "No actors found." : "Loading actors..."}
              </p>
            ) : (
              actors.map((actor) => (
                <div key={actor.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`actor-${actor.id}`}
                    checked={selectedActors.includes(actor.displayName)}
                    onCheckedChange={(_checked) => {
                      toggleActor(actor.displayName);
                    }}
                  />
                  <Label
                    htmlFor={`actor-${actor.id}`}
                    className="text-sm font-normal cursor-pointer flex-1 truncate"
                  >
                    {actor.displayName}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({actor.observationCount})
                    </span>
                  </Label>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
