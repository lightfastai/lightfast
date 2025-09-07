import type { ReactNode } from "react";
import { SignedOut, RedirectToTasks } from '@clerk/nextjs';

interface OrgsLayoutProps {
  children: ReactNode;
}

/**
 * Organizations Layout
 * 
 * Layout for organization-specific pages that require full authentication.
 * Redirects unauthenticated users to complete auth tasks.
 */
export default function OrgsLayout({ children }: OrgsLayoutProps) {
  return (
    <>
      <SignedOut>
        <RedirectToTasks />
      </SignedOut>
      {children}
    </>
  );
}