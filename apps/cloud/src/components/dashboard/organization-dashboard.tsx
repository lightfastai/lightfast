"use client";

import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

interface OrganizationDashboardProps {
  organizationId: string;
}

export function OrganizationDashboard({ organizationId }: OrganizationDashboardProps) {
  const trpc = useTRPC();
  
  // Fetch organization context and usage data
  const { data: orgContext } = useQuery({
    ...trpc.organization.getContext.queryOptions(),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: orgUsage } = useQuery({
    ...trpc.organization.getUsage.queryOptions(), 
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: apiKeys } = useQuery({
    ...trpc.apiKey.list.queryOptions({ includeInactive: false }),
    staleTime: 60 * 1000, // 1 minute
  });

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Section */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Welcome to Lightfast Cloud
        </h1>
        <p className="text-muted-foreground mb-4">
          Your cloud-native agent execution engine dashboard. Manage API keys, monitor agents, and configure deployments.
        </p>
        
        {orgContext && (
          <div className="text-sm text-muted-foreground">
            <span>Organization ID: </span>
            <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
              {orgContext.organizationId}
            </code>
            <span className="ml-4">Role: </span>
            <span className="capitalize font-medium">
              {orgContext.role?.replace('org:', '')}
            </span>
          </div>
        )}
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="border border-border rounded-lg p-6 bg-card">
          <h3 className="text-sm font-medium text-foreground mb-2">
            API Keys
          </h3>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {apiKeys?.length || 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
            <span>Active keys</span>
            {orgUsage && (
              <span>{orgUsage.apiKeysUsed}/{orgUsage.apiKeysLimit}</span>
            )}
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <h3 className="text-sm font-medium text-foreground mb-2">
            Deployments
          </h3>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {orgUsage?.deploymentsUsed || 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
            <span>Active deployments</span>
            {orgUsage && (
              <span>{orgUsage.deploymentsUsed}/{orgUsage.deploymentsLimit}</span>
            )}
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <h3 className="text-sm font-medium text-foreground mb-2">
            Monthly Executions
          </h3>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {(orgUsage?.monthlyExecutionsUsed || 0).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
            <span>This month</span>
            {orgUsage && (
              <span>{orgUsage.monthlyExecutionsUsed.toLocaleString()}/{orgUsage.monthlyExecutionsLimit.toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <h3 className="text-sm font-medium text-foreground mb-2">
            Plan Status
          </h3>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 capitalize">
            Free
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Upgrade for more resources
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <a
              href="/settings/api-keys"
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div>
                <div className="font-medium">Manage API Keys</div>
                <div className="text-sm text-muted-foreground">Create and manage authentication keys</div>
              </div>
              <div className="text-blue-600 dark:text-blue-400">→</div>
            </a>
            
            <a
              href="/settings"
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div>
                <div className="font-medium">Organization Settings</div>
                <div className="text-sm text-muted-foreground">Configure your organization</div>
              </div>
              <div className="text-blue-600 dark:text-blue-400">→</div>
            </a>
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <h3 className="text-lg font-semibold mb-4">
            Recent Activity  
          </h3>
          <div className="text-muted-foreground">
            No recent activity to display.
          </div>
        </div>
      </div>
    </div>
  );
}