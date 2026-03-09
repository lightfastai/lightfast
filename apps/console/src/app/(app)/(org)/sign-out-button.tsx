"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useClerk } from "@vendor/clerk/client";
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
    <Button className="rounded-full" onClick={handleSignOut} size="lg">
      Sign in as a different user
    </Button>
  );
}
