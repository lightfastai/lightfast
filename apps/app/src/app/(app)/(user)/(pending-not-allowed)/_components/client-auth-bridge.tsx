"use client";

import { useAuth } from "@vendor/clerk/client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

export interface ClientAuthBridgeProps {
  buildRedirectUrl: (args: {
    token: string;
    searchParams: URLSearchParams;
  }) => string | null;
  jwtTemplate?: string;
  title: string;
  subtitle: string;
  fallback?: ReactNode;
}

function BridgeContent(props: ClientAuthBridgeProps) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">(
    "loading"
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      try {
        const token = await getToken(
          props.jwtTemplate ? { template: props.jwtTemplate } : undefined
        );
        if (!token) {
          setStatus("error");
          return;
        }
        const url = props.buildRedirectUrl({ token, searchParams });
        if (!url) {
          setStatus("error");
          return;
        }
        setStatus("redirecting");
        window.location.href = url;
      } catch {
        setStatus("error");
      }
    })();
  }, [isLoaded, isSignedIn, getToken, props, searchParams]);

  if (status === "error") {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <h1 className="font-semibold text-xl">Authentication Failed</h1>
          <p className="mt-2 text-muted-foreground">
            Invalid parameters. Please try again from the Lightfast app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="text-center">
        <h1 className="font-semibold text-xl">
          {status === "redirecting" ? "Opening Lightfast…" : props.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{props.subtitle}</p>
      </div>
    </div>
  );
}

export function ClientAuthBridge(props: ClientAuthBridgeProps) {
  return (
    <Suspense fallback={props.fallback ?? null}>
      <BridgeContent {...props} />
    </Suspense>
  );
}
