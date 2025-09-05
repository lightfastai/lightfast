"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

/**
 * Organization Switcher Component
 * 
 * Provides organization switching functionality in the main navigation.
 * Configured for B2B use case with personal accounts hidden.
 */
export function OrganizationSwitcherComponent() {
  return (
    <OrganizationSwitcher
      hidePersonal // Hide personal account option for B2B focus
      appearance={{
        elements: {
          organizationSwitcherTrigger: "border border-border hover:bg-accent",
          organizationSwitcherPopoverMain: "bg-popover border border-border",
          organizationSwitcherPopoverActions: "border-t border-border",
          organizationPreviewMainIdentifier: "text-foreground",
          organizationPreviewSecondaryIdentifier: "text-muted-foreground",
        }
      }}
      createOrganizationMode="modal"
      afterCreateOrganizationUrl="/dashboard"
      afterSelectOrganizationUrl="/dashboard"
      afterLeaveOrganizationUrl="/onboarding"
    />
  );
}