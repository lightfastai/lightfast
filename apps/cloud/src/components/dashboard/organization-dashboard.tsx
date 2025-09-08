"use client";

import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/ui/button";
import { Plus, Sparkles, Key } from "lucide-react";
import Link from "next/link";

interface OrganizationDashboardProps {
  organizationId: string;
}

export function OrganizationDashboard({ organizationId }: OrganizationDashboardProps) {
  const trpc = useTRPC();
  
  // Fetch user data
  const { data: userData } = useSuspenseQuery({
    ...trpc.user.getUser.queryOptions(),
    staleTime: Infinity, // User profile data rarely changes, cache for entire session
    gcTime: Infinity, // Keep in cache indefinitely
  });

  // Fetch organization context
  const { data: orgContext } = useSuspenseQuery({
    ...trpc.organization.getContext.queryOptions(),
    staleTime: 60 * 1000, // 1 minute
  });

  // TODO: Replace with actual agents query when available
  const mockAgents = [
    {
      id: "1",
      name: "Customer Support Bot",
      createdAt: "Nov 15, 2024",
      author: userData?.username || userData?.firstName || "user"
    },
    {
      id: "2", 
      name: "Data Analysis Agent",
      createdAt: "Nov 10, 2024",
      author: userData?.username || userData?.firstName || "user"
    }
  ];

  // Determine display name: prefer username, then firstName, then fallback
  const displayName = userData?.username || userData?.firstName || 'user';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-medium text-foreground mb-4">
            Good afternoon, {displayName}
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-6 bg-card border-border hover:bg-muted/50 text-foreground"
            asChild
          >
            <Link href="/agents/create">
              <Plus className="w-5 h-5 mr-3" />
              Create an agent
            </Link>
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-6 bg-card border-border hover:bg-muted/50 text-foreground"
            asChild
          >
            <Link href="/agents/generate">
              <Sparkles className="w-5 h-5 mr-3" />
              Generate an agent
            </Link>
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-6 bg-card border-border hover:bg-muted/50 text-foreground"
            asChild
          >
            <Link href="/settings/api-keys">
              <Key className="w-5 h-5 mr-3" />
              Get API Key
            </Link>
          </Button>
        </div>

        {/* Agents List */}
        <div className="space-y-4">
          {mockAgents.map((agent) => (
            <div
              key={agent.id}
              className="bg-card border border-border rounded-lg p-6 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {agent.createdAt} by {agent.author}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {mockAgents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No agents created yet. Get started by creating your first agent.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}