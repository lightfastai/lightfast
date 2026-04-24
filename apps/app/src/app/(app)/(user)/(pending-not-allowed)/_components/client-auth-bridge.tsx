"use client";

import { captureException, captureMessage } from "@sentry/nextjs";
import { useAuth } from "@vendor/clerk/client";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";

interface ClientAuthBridgeBaseProps {
  fallback?: ReactNode;
  jwtTemplate?: string;
  subtitle: string;
  title: string;
}

interface PostCallbackProps {
  buildPostCallback: (args: {
    searchParams: URLSearchParams;
  }) => { url: string; state: string } | null;
  mode: "post";
}

interface RedirectProps {
  buildRedirectUrl: (args: {
    token: string;
    searchParams: URLSearchParams;
  }) => string | null;
  mode: "redirect";
}

export type ClientAuthBridgeProps = ClientAuthBridgeBaseProps &
  (PostCallbackProps | RedirectProps);

type BridgeStatus = "loading" | "redirecting" | "success" | "error";

function BridgeContent(props: ClientAuthBridgeProps) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<BridgeStatus>("loading");
  const didStart = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: handshake is one-shot, latched by didStart.current — re-firing the effect would double-POST the token.
  useEffect(() => {
    if (!isLoaded || didStart.current) {
      return;
    }
    if (!isSignedIn) {
      didStart.current = true;
      setStatus("error");
      return;
    }
    didStart.current = true;
    void (async () => {
      try {
        const token = await getToken(
          props.jwtTemplate ? { template: props.jwtTemplate } : undefined
        );
        if (!token) {
          setStatus("error");
          return;
        }
        if (props.mode === "post") {
          const built = props.buildPostCallback({ searchParams });
          if (!built) {
            captureMessage("auth-bridge: buildPostCallback returned null", {
              level: "warning",
              tags: { scope: "auth-bridge.invalid_callback" },
            });
            setStatus("error");
            return;
          }
          let response: Response;
          try {
            response = await fetch(built.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, state: built.state }),
              credentials: "omit",
            });
          } catch (error) {
            captureException(error, {
              tags: { scope: "auth-bridge.fetch_network_error" },
            });
            setStatus("error");
            return;
          }
          if (!response.ok) {
            captureMessage("auth-bridge: loopback POST non-ok", {
              level: "warning",
              tags: {
                scope: "auth-bridge.fetch_non_ok",
                status: String(response.status),
              },
            });
            setStatus("error");
            return;
          }
          setStatus("success");
          return;
        }
        const url = props.buildRedirectUrl({ token, searchParams });
        if (!url) {
          setStatus("error");
          return;
        }
        setStatus("redirecting");
        window.location.href = url;
      } catch (error) {
        captureException(error, {
          tags: { scope: "auth-bridge.unexpected_error" },
        });
        setStatus("error");
      }
    })();
  }, [isLoaded, isSignedIn]);

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

  if (status === "success") {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <h1 className="font-semibold text-xl">Signed in to Lightfast</h1>
          <p className="mt-2 text-muted-foreground">
            You can close this tab and return to Lightfast.
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
