import React, { useState } from "react";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { Link } from "@tanstack/react-router";
import { HistoryIcon, Search } from "lucide-react";

import type { RouterOutputs } from "@vendor/trpc";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

interface HistoryMenuProps {
  sessions?: RouterOutputs["tenant"]["session"]["list"];
}

export const HistoryMenu: React.FC<HistoryMenuProps> = ({ sessions }) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter sessions based on search query
  const filteredSessions = sessions?.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs">
          <HistoryIcon className="text-muted-foreground size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Search input */}
        <div className="relative flex items-center justify-center">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-8 text-xs"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <DropdownMenuSeparator />

        {/* Past sessions label */}
        <DropdownMenuLabel className="text-muted-foreground/70 font-mono text-xs">
          Past Sessions
        </DropdownMenuLabel>

        {/* Sessions list with ScrollArea */}
        <ScrollArea className="h-[180px]">
          <div className="px-1 py-1">
            {filteredSessions && filteredSessions.length > 0 ? (
              filteredSessions.map((session) => (
                <Link
                  className="text-muted-foreground hover:text-accent-foreground hover:bg-accent flex w-full items-center rounded-sm px-2 py-1.5 text-xs transition-colors"
                  key={session.id}
                  to="/$sessionId"
                  params={{ sessionId: session.id }}
                >
                  <div className="min-w-0 flex-1 overflow-hidden pr-2 font-mono text-ellipsis whitespace-nowrap">
                    {session.title.trim() || "Untitled"}
                  </div>
                  <div className="text-muted-foreground/70 shrink-0 font-mono text-[0.65rem] whitespace-nowrap">
                    {useTimeAgo(session.updatedAt)}
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-muted-foreground/50 px-2 py-2 text-center text-xs">
                {searchQuery
                  ? "No matching sessions found"
                  : "No sessions available"}
              </div>
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
