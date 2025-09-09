"use client";

import { memo, useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ExternalLink, Copy, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { useTRPC } from "~/trpc/react";
import { ViewToggle, type ViewType } from "./view-toggle";
import { SearchAndFilter } from "./search-and-filter";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

const EnhancedAgentList = memo(function EnhancedAgentList() {
  const [view, setView] = useState<ViewType>("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const params = useParams();
  const orgSlug = params.slug as string;
  
  const trpc = useTRPC();
  const { data: agentsData, isLoading, error } = useQuery({
    ...trpc.agent.list.queryOptions(),
  });

  const filteredAgents = useMemo(() => {
    if (!agentsData?.agents) return [];
    
    let filtered = agentsData.agents;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status/type filter
    switch (filter) {
      case "deployed":
        // All agents are deployed for now, but this could filter by status
        break;
      case "recent":
        // Sort by most recent
        filtered = [...filtered].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      default:
        break;
    }
    
    return filtered;
  }, [agentsData?.agents, searchTerm, filter]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          Error loading agents: {error.message}
        </p>
      </div>
    );
  }

  if (!agentsData?.agents?.length) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No agents deployed yet. Use the CLI to deploy your first agent.
        </p>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>To deploy an agent:</p>
          <code className="mt-2 block p-2 bg-muted rounded">
            lightfast deploy
          </code>
        </div>
      </div>
    );
  }

  const AgentCard = ({ agent }: { agent: any }) => (
    <Link href={`/orgs/${orgSlug}/agent/${encodeURIComponent(agent.name)}`}>
      <div className="group p-4 border rounded-lg bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium truncate text-foreground">{agent.name}</h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Deployed
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); copyToClipboard(agent.id); }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy ID
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); copyToClipboard(agent.bundleUrl); }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Bundle URL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3">
          Deployed {format(new Date(agent.createdAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto p-0 text-xs text-primary hover:underline"
            onClick={(e) => { e.preventDefault(); window.open(agent.bundleUrl, '_blank'); }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View Bundle
          </Button>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground truncate">
            ID: {agent.id.slice(-8)}
          </span>
        </div>
      </div>
    </Link>
  );

  const AgentListItem = ({ agent }: { agent: any }) => (
    <Link href={`/orgs/${orgSlug}/agent/${encodeURIComponent(agent.name)}`}>
      <div className="group flex items-center justify-between p-4 border-b bg-card hover:bg-muted/50 transition-colors cursor-pointer">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate text-foreground">{agent.name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              Deployed {format(new Date(agent.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Deployed
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.preventDefault(); window.open(agent.bundleUrl, '_blank'); }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Bundle
            </Button>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.preventDefault()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); copyToClipboard(agent.id); }}>
              <Copy className="h-4 w-4 mr-2" />
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); copyToClipboard(agent.bundleUrl); }}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Bundle URL
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SearchAndFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filter={filter}
          onFilterChange={setFilter}
          totalItems={filteredAgents.length}
        />
        <ViewToggle view={view} onViewChange={setView} />
      </div>

      {filteredAgents.length === 0 && (searchTerm || filter !== "all") ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No agents match your search criteria.
          </p>
        </div>
      ) : (
        <>
          {view === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden">
              {filteredAgents.map((agent) => (
                <AgentListItem key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export { EnhancedAgentList };