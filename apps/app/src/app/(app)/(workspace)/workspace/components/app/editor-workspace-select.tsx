"use client";

import { useState } from "react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

import { DropdownTriggerButton } from "~/components/ui/button";
import { useGetAllWorkspaces } from "../../hooks/use-get-all-workspace";
import { EditorWorkspaceSearch } from "./editor-workspace-search";

export const EditorWorkspaceSelect = () => {
  const allWorkspaces = useGetAllWorkspaces();
  const [search, setSearch] = useState("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <DropdownTriggerButton variant="outline">
          Workspace
        </DropdownTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-0">
        <DropdownMenuItem className="w-full p-0">
          <EditorWorkspaceSearch value={search} onChange={setSearch} />
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuGroup asChild>
          <ScrollArea className="h-64">
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspaces
            </DropdownMenuLabel>
            {allWorkspaces
              ?.filter((ws) =>
                ws.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((ws) => (
                <DropdownMenuItem key={ws.id} asChild>
                  <Link href={`/workspace/${ws.id}`}>
                    <span className="truncate">{ws.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
          </ScrollArea>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
