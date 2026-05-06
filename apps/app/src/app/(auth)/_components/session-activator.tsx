"use client";

import { Icons } from "@repo/ui/components/icons";
import { addBreadcrumb, startSpan } from "@sentry/nextjs";
import { useAuth, useSignIn } from "@vendor/clerk/client";
import Link from "next/link";
import * as React from "react";

interface SessionActivatorProps {
  token: string;
}

export function SessionActivator({ token }: SessionActivatorProps) {
  const { isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const [error, setError] = React.useState<string | null>(null);
  const hasActivatedRef = React.useRef(false);

  React.useEffect(() => {
    if (!(isLoaded && signIn) || hasActivatedRef.current) {
      return;
    }
    hasActivatedRef.current = true;

    async function activate() {
      if (!signIn) {
        return;
      }

      addBreadcrumb({
        category: "auth",
        message: "Session activation via ticket",
        level: "info",
      });
      const { error: ticketError } = await startSpan(
        { name: "auth.session.activate", op: "auth" },
        () => signIn.ticket({ ticket: token })
      );
      if (ticketError) {
        setError("Sign-in failed. Please try again.");
        return;
      }
      if (signIn.status === "complete") {
        addBreadcrumb({
          category: "auth",
          message: "Session activated",
          level: "info",
        });
        await signIn.finalize({
          navigate: async () => {
            window.location.href = "/account/welcome";
          },
        });
      } else {
        setError("Sign-in failed. Please try again.");
      }
    }
    activate().catch(() => {
      setError("Sign-in failed. Please try again.");
    });
  }, [isLoaded, token, signIn]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-destructive text-sm">{error}</p>
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
