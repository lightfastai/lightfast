"use client";

import { useEffect } from "react";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useFormContext } from "react-hook-form";
import { Building2 } from "lucide-react";
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
import { useWorkspaceSearchParams } from "./use-workspace-search-params";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";

/**
 * Organization Selector
 * Client island for organization selection with Clerk integration
 * Syncs with URL teamSlug parameter and provides form validation
 */
export function OrganizationSelector() {
  const { organization } = useOrganization();
  const { userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });
  const form = useFormContext<WorkspaceFormValues>();
  const { teamSlug, setTeamSlug } = useWorkspaceSearchParams();

  const selectedOrgId = form.watch("organizationId");

  // Auto-select organization from URL teamSlug or current organization
  useEffect(() => {
    if (!selectedOrgId && userMemberships.data) {
      // Priority 1: Use teamSlug from URL
      if (teamSlug) {
        const orgFromSlug = userMemberships.data.find(
          (membership) => membership.organization.slug === teamSlug
        );
        if (orgFromSlug) {
          form.setValue("organizationId", orgFromSlug.organization.id);
          return;
        }
      }

      // Priority 2: Use current organization
      if (organization?.id) {
        form.setValue("organizationId", organization.id);
      }
    }
  }, [
    organization?.id,
    selectedOrgId,
    form,
    teamSlug,
    userMemberships.data,
  ]);

  // Update URL when organization changes
  const handleOrgChange = (orgId: string) => {
    // Find the org slug and update URL
    const selectedOrg = userMemberships.data?.find(
      (membership) => membership.organization.id === orgId
    );
    if (selectedOrg) {
      void setTeamSlug(selectedOrg.organization.slug ?? "");
    }
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
              {userMemberships.data?.map((membership) => (
                <SelectItem
                  key={membership.organization.id}
                  value={membership.organization.id}
                >
                  <div className="flex items-center gap-2">
                    {membership.organization.imageUrl ? (
                      <img
                        src={membership.organization.imageUrl}
                        alt={membership.organization.name}
                        className="h-5 w-5 rounded"
                      />
                    ) : (
                      <Building2 className="h-5 w-5" />
                    )}
                    <span>{membership.organization.name}</span>
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
