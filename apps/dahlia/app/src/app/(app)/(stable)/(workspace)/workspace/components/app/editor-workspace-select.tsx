"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";
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

import { useGetAllWorkspaces } from "../../hooks/use-get-all-workspace";
import { EditorWorkspaceSearch } from "./editor-workspace-search";

export const EditorWorkspaceSelect = () => {
  const allWorkspaces = useGetAllWorkspaces();
  const [search, setSearch] = useState("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Workspace</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <EditorWorkspaceSearch value={search} onChange={setSearch} />
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuGroup>
          <ScrollArea className="h-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
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
