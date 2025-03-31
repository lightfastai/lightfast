"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronsUpDownIcon, Search } from "lucide-react";

import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  ForwardedDropdownMenuTriggerButton,
} from "~/components/ui/dropdown-menu";
import { useGetAllWorkspaces } from "../../hooks/use-get-all-workspace";

export function EditorWorkspaceListMenu() {
  const allWorkspaces = useGetAllWorkspaces();
  const [search, setSearch] = useState("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ForwardedDropdownMenuTriggerButton variant="ghost">
          <ChevronsUpDownIcon className="size-3" />
        </ForwardedDropdownMenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        <div className="relative w-full border-b border-t">
          <Label htmlFor="search" className="sr-only text-xs">
            Search
          </Label>
          <Input
            id="search"
            type="text"
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find workspace..."
            className="h-7 rounded-none border-none pl-8 text-xs focus-visible:ring-0 md:text-xs"
          />
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 select-none opacity-50" />
        </div>
        <ScrollArea className="h-64 w-64">
          {allWorkspaces
            ?.filter((ws) =>
              ws.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((ws) => (
              <DropdownMenuItem key={ws.id}>
                <Link href={`/workspace/${ws.id}`} className="w-full">
                  <span className="truncate">{ws.name}</span>
                </Link>
              </DropdownMenuItem>
            ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
