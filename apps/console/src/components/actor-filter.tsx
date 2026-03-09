"use client";

import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

interface ActorFilterProps {
  onSelectionChange: (actors: string[]) => void;
  orgSlug: string;
  selectedActors: string[];
  workspaceName: string;
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
      workspaceName,
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
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 w-full justify-between font-normal"
          variant="outline"
        >
          <span className="truncate">
            {selectedActors.length > 0
              ? `${selectedActors.length} selected`
              : "Select actors..."}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[250px] p-3">
        <div className="space-y-3">
          <Input
            className="h-8"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actors..."
            value={search}
          />
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {!actors || actors.length === 0 ? (
              <p className="py-2 text-center text-muted-foreground text-sm">
                {search ? "No actors found." : "Loading actors..."}
              </p>
            ) : (
              actors.map((actor) => (
                <div className="flex items-center gap-2" key={actor.id}>
                  <Checkbox
                    checked={selectedActors.includes(actor.displayName)}
                    id={`actor-${actor.id}`}
                    onCheckedChange={(_checked) => {
                      toggleActor(actor.displayName);
                    }}
                  />
                  <Label
                    className="flex-1 cursor-pointer truncate font-normal text-sm"
                    htmlFor={`actor-${actor.id}`}
                  >
                    {actor.displayName}
                    <span className="ml-1 text-muted-foreground text-xs">
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
