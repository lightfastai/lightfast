"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

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

  const { data: actors } = useQuery({
    ...trpc.workspace.getActors.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName: workspaceName,
      search: search || undefined,
      limit: 20,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000, // 1 minute
  });

  const toggleActor = useCallback(
    (displayName: string) => {
      if (selectedActors.includes(displayName)) {
        onSelectionChange(selectedActors.filter((a) => a !== displayName));
      } else {
        onSelectionChange([...selectedActors, displayName]);
      }
    },
    [selectedActors, onSelectionChange]
  );

  const removeActor = useCallback(
    (displayName: string) => {
      onSelectionChange(selectedActors.filter((a) => a !== displayName));
    },
    [selectedActors, onSelectionChange]
  );

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Actors</span>
      <div className="flex flex-wrap gap-1">
        {/* Selected actors as badges */}
        {selectedActors.map((actor) => (
          <Badge key={actor} variant="default" className="gap-1">
            {actor}
            <button
              onClick={() => removeActor(actor)}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Add actor button/combobox */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-6 px-2 text-xs gap-1"
            >
              Add actor
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search actors..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No actors found.</CommandEmpty>
                <CommandGroup>
                  {actors?.map((actor) => (
                    <CommandItem
                      key={actor.id}
                      value={actor.displayName}
                      onSelect={() => {
                        toggleActor(actor.displayName);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedActors.includes(actor.displayName)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex-1 truncate">
                        <span>{actor.displayName}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({actor.observationCount})
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
