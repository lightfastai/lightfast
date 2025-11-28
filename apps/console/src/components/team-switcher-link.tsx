"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";

interface TeamSwitcherLinkProps {
  orgId: string;
  orgSlug: string;
  workspaceName?: string;
  children: React.ReactNode;
  className?: string;
  onSwitch?: () => void;
}

/**
 * TeamSwitcherLink - Link component that handles organization switching
 *
 * This component wraps a Next.js Link and intercepts clicks to:
 * 1. Call setActive() to update Clerk's active organization
 * 2. Navigate with updated cookies
 *
 * Why this works:
 * - setActive() updates Clerk cookies immediately
 * - router.push() makes RSC request with updated cookies
 * - Layout's auth() reads correct org from cookies
 * - No mismatch, no "not found"
 *
 * When workspaceName is provided:
 * - Ensures org is active before navigating to workspace
 * - Prevents race conditions where workspace page loads before org is active
 *
 * Used with DropdownMenuItem asChild - the DropdownMenuItem provides
 * the button styling and behavior, this Link just handles navigation.
 */
export function TeamSwitcherLink({
  orgId,
  orgSlug,
  workspaceName,
  children,
  className,
  onSwitch,
}: TeamSwitcherLinkProps) {
  const router = useRouter();
  const { setActive } = useOrganizationList();

  // Build the target URL - include workspace if provided
  const targetUrl = workspaceName
    ? `/${orgSlug}/${workspaceName}`
    : `/${orgSlug}`;

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Don't intercept special clicks (new tab, etc)
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      return;
    }

    e.preventDefault();

    // Call onSwitch callback (e.g., to close dropdown)
    onSwitch?.();

    try {
      // Set active organization in Clerk
      if (setActive) {
        await setActive({ organization: orgId });
      }

      // Navigate with updated cookies (client-side navigation)
      router.push(targetUrl);
    } catch (error) {
      console.error("Failed to switch organization:", error);
    }
  };

  return (
    <Link
      href={targetUrl}
      onClick={handleClick}
      className={className}
      prefetch={true}
    >
      {children}
    </Link>
  );
}
