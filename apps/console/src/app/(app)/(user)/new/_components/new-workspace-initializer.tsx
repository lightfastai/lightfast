"use client";

import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { WorkspaceFormProvider } from "./workspace-form-provider";

interface NewWorkspaceInitializerProps {
  teamSlugHint?: string;
  initialWorkspaceName?: string;
  children: ReactNode;
}

/**
 * NewWorkspaceInitializer
 *
 * Client component that initializes workspace creation form state from:
 * 1. Cached organization.listUserOrganizations (from app layout)
 * 2. URL parameters (teamSlug hint, workspace name)
 *
 * This ensures consistent tRPC usage (no mixing with Clerk server APIs)
 * and handles timing issues after org creation (cache is optimistically updated).
 *
 * Data Flow:
 * 1. Read cached org list (already prefetched in (app)/layout.tsx)
 * 2. Find org matching teamSlugHint (if provided)
 * 3. Fallback to most recent org
 * 4. Pass initial values to WorkspaceFormProvider
 */
export function NewWorkspaceInitializer({
  teamSlugHint,
  initialWorkspaceName,
  children,
}: NewWorkspaceInitializerProps) {
  const trpc = useTRPC();

  // Read cached organization list (prefetched in app layout)
  // This works even for users who just created their first org (optimistic update)
  const { data: organizations } = useSuspenseQuery({
    ...userTrpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Determine initial organization ID
  let initialOrgId: string | undefined;

  if (teamSlugHint) {
    // Try to find org by slug from URL hint
    const org = organizations.find((o) => o.slug === teamSlugHint);
    if (org) {
      initialOrgId = org.id;
    }
  }

  // Fallback: pick the most recent organization (first in list)
  if (!initialOrgId && organizations.length > 0) {
    initialOrgId = organizations[0]?.id;
  }

  return (
    <WorkspaceFormProvider
      initialOrgId={initialOrgId}
      initialWorkspaceName={initialWorkspaceName}
    >
      {children}
    </WorkspaceFormProvider>
  );
}
