"use client";

import { useUser } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";

export function AuthStatus() {
  const { isSignedIn } = useUser();

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Signed in</span>
      <UserButton />
    </div>
  );
}