"use client";

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
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";

const DATA_SOURCES = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "slack", label: "Slack" },
  { value: "notion", label: "Notion" },
  { value: "linear", label: "Linear" },
  { value: "jira", label: "Jira" },
  { value: "confluence", label: "Confluence" },
  { value: "google-drive", label: "Google Drive" },
  { value: "microsoft-teams", label: "Microsoft Teams" },
  { value: "discord", label: "Discord" },
];

const DATA_SOURCES_MAP = new Map(DATA_SOURCES.map((s) => [s.value, s]));

interface SourcesIslandProps {
  defaultSources: string[];
  error?: string | null;
}

export function SourcesIsland({ defaultSources, error }: SourcesIslandProps) {
  const [selected, setSelected] = useState<string[]>(defaultSources);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <label
        className="font-medium text-muted-foreground text-xs"
        htmlFor="sources"
      >
        Tools your team uses
      </label>
      <input
        id="sources"
        name="sources"
        type="hidden"
        value={selected.join(",")}
      />
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-controls="sources-listbox"
            aria-expanded={open}
            className={cn(
              "h-auto min-h-8 w-full justify-start px-2 py-1 font-normal",
              !selected.length && "text-muted-foreground"
            )}
            role="combobox"
            variant="outline"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {selected.length > 0 ? (
                  selected.map((value) => {
                    const source = DATA_SOURCES_MAP.get(value);
                    return (
                      <Badge
                        className="gap-1 pr-1"
                        key={value}
                        variant="secondary"
                      >
                        {source?.label}
                        <span
                          className="ml-1 cursor-pointer rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(selected.filter((s) => s !== value));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelected(selected.filter((s) => s !== value));
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </Badge>
                    );
                  })
                ) : (
                  <span>Select tools</span>
                )}
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-full p-0">
          <Command id="sources-listbox">
            <CommandInput placeholder="Search tools..." />
            <CommandList>
              <CommandEmpty>No tools found.</CommandEmpty>
              <CommandGroup>
                {DATA_SOURCES.map((source) => {
                  const isSelected = selected.includes(source.value);
                  return (
                    <CommandItem
                      key={source.value}
                      onSelect={() => {
                        setSelected(
                          isSelected
                            ? selected.filter((s) => s !== source.value)
                            : [...selected, source.value]
                        );
                      }}
                      value={source.value}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {source.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
