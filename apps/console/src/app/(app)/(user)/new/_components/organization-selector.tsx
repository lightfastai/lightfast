"use client";

import { useFormContext } from "react-hook-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { useWorkspaceSearchParams } from "./use-workspace-search-params";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";

/**
 * Organization Selector
 * Client island for organization selection using tRPC cached data
 * Syncs with URL teamSlug parameter and provides form validation
 *
 * Uses organization.listUserOrganizations cache from (app)/layout.tsx
 */
export function OrganizationSelector() {
  const trpc = useTRPC();
  const form = useFormContext<WorkspaceFormValues>();
  const { setTeamSlug } = useWorkspaceSearchParams();

  // Read cached organization list (already prefetched in app layout)
  const { data: organizations } = useSuspenseQuery({
    ...userTrpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Update URL when organization changes
  const handleOrgChange = (orgId: string) => {
    // Find the org slug and update URL
    const selectedOrg = organizations.find((org) => org.id === orgId);
    if (selectedOrg) {
      void setTeamSlug(selectedOrg.slug);
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <FormField
      control={form.control}
      name="organizationId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Organization</FormLabel>
          <Select
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              handleOrgChange(value);
            }}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[10px] bg-foreground text-background">
                        {getInitials(org.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{org.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>
            Choose which organization this workspace belongs to
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
