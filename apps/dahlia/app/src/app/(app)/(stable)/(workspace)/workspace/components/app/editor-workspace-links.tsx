"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";
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

import { useGetWorkspace } from "../../hooks/use-get-workspace";
import { useGetAllWorkspaces } from "../../hooks/use-get-workspace copy";
import { EditorWorkspaceSearch } from "./editor-workspace-search";

export const EditorWorkspaceLinks = ({ id }: { id: string }) => {
  const router = useRouter();
  const workspace = useGetWorkspace({ id });
  const allWorkspaces = useGetAllWorkspaces();
  const [search, setSearch] = useState("");
  return (
    <div className="fixed inset-x-20 top-4 z-50 flex w-max items-center">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Workspace</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-0">
                <EditorWorkspaceSearch value={search} onChange={setSearch} />
                <DropdownMenuSeparator className="my-0" />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Workspaces
                  </DropdownMenuLabel>
                  <ScrollArea className="h-64">
                    {allWorkspaces
                      ?.filter((ws) =>
                        ws.name.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((ws) => (
                        <DropdownMenuItem key={ws.id}>
                          <Link href={`/workspace/${ws.id}`}>
                            <span className="truncate">{ws.name}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                  </ScrollArea>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>{workspace?.name}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
