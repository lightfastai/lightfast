"use client";

import { useClerk } from "@clerk/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import { authUrl } from "~/lib/related-projects";

/**
 * Sign out button for not-found page
 *
 * Signs the user out and redirects to the auth app's sign-in page
 */
export function SignOutButton() {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut({ redirectUrl: `${authUrl}/sign-in` });
  };

  return (
    <Button onClick={handleSignOut} size="lg" className="rounded-full">
      Sign in as a different user
    </Button>
  );
}
