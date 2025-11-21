"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Database, Key, Tag } from "lucide-react";
import type { WorkspaceResolutionFromOrgId, OrganizationDetailFromOrgId } from "~/types";

/**
 * Convert slug to friendly display name
 * Example: "robust-chicken" → "Robust Chicken"
 */
function slugToFriendlyName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface WorkspaceInfoProps {
  workspace: WorkspaceResolutionFromOrgId;
  organization?: Pick<OrganizationDetailFromOrgId, "name" | "slug" | "imageUrl">;
}

/**
 * Workspace Info Component
 *
 * Displays workspace metadata at the top of the workspace dashboard.
 * Shows workspace name, key, and organization context.
 */
export function WorkspaceInfo({ workspace, organization }: WorkspaceInfoProps) {
  const friendlyName = slugToFriendlyName(workspace.workspaceSlug);

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              {friendlyName}
            </CardTitle>
            <CardDescription className="mt-2">
              {organization?.name && `${organization.name} workspace`}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="px-3 py-1">
            Default Workspace
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Workspace Slug */}
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-muted p-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-1">Slug</p>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded break-all">
                {workspace.workspaceSlug}
              </p>
            </div>
          </div>

          {/* Workspace Key */}
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-muted p-2">
              <Key className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-1">Key</p>
              <p className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">
                {workspace.workspaceKey}
              </p>
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            This workspace contains all searchable content from your connected sources (GitHub, Linear, Notion, Sentry).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
