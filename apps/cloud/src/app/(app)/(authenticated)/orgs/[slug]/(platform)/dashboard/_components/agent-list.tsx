"use client";

import { memo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

const AgentList = memo(function AgentList() {
  const trpc = useTRPC();
  const { data: agentsData, isLoading, error } = useQuery({
    ...trpc.agent.list.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading agents...</p>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Deployed Agents ({agentsData.total})
        </h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agentsData.agents.map((agent) => (
          <div
            key={agent.id}
            className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium truncate">{agent.name}</h3>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Deployed
                </span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              Deployed {format(new Date(agent.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
            
            <div className="flex items-center gap-2">
              <a
                href={agent.bundleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View Bundle
              </a>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground truncate">
                ID: {agent.id.slice(-8)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export { AgentList };