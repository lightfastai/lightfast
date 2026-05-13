"use client";

import { Icons } from "@repo/ui/components/icons";
import Link from "next/link";
import { useAuthFlow } from "../_hooks/use-auth-flow";

interface SessionActivatorProps {
  token: string;
}

export function SessionActivator({ token }: SessionActivatorProps) {
  const { activate } = useAuthFlow({
    mode: "sign-in",
    step: "activate",
    token,
  });

  if (activate.error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-destructive text-sm">{activate.error}</p>
        <Link
          className="text-muted-foreground text-sm underline"
          href="/sign-in"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Icons.spinner className="h-4 w-4 animate-spin" />
      <span>Signing in...</span>
    </div>
  );
}
