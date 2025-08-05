"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

export interface Project {
  value: string;
  label: string;
  href: string;
}

interface ProjectSwitcherProps {
  projects: Project[];
  currentProject: string;
}

export function ProjectSwitcher({ projects, currentProject }: ProjectSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const selectedProject = projects.find(p => p.value === currentProject);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a project"
          className="w-[200px] justify-between"
        >
          {selectedProject?.label ?? "Select project..."}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search project..." />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.value}
                  value={project.value}
                  onSelect={() => {
                    setOpen(false);
                    // Navigate to the project
                    window.location.href = project.href;
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentProject === project.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {project.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}