"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useClerk } from "@vendor/clerk/client";

export function SignOutButton() {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/sign-in" });
  };

  return (
    <Button className="rounded-full" onClick={handleSignOut} size="lg">
      Sign in as a different user
    </Button>
  );
}
