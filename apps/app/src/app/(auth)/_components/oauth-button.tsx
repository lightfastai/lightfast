"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import type { OAuthStrategy } from "@vendor/clerk/types";
import { useAuthFlow } from "../_hooks/use-auth-flow";

interface OAuthButtonProps {
  label: string;
  mode: "sign-in" | "sign-up";
  onWaitlistError?: () => void;
  strategy: OAuthStrategy;
  ticket?: string | null;
}

export function OAuthButton({
  mode,
  ticket,
  strategy,
  label,
  onWaitlistError,
}: OAuthButtonProps) {
  const { oauth } = useAuthFlow({
    mode,
    step: "email",
    ticket,
    onWaitlistError,
  });

  return (
    <Button
      className="w-full"
      disabled={oauth.loading}
      onClick={() => oauth.initiate(strategy)}
      size="lg"
      variant="outline"
    >
      {oauth.loading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.gitHub className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
