"use client";

import { Icons } from "@repo/ui/components/icons";
import { useClerk, useSignIn, useSignUp } from "@vendor/clerk/client";
import * as React from "react";
import { mapOAuthClerkError } from "../_hooks/auth-errors";
import { makeFinalizeNavigate } from "../_hooks/auth-navigate";

const SUCCESS_REDIRECT = "/";

// Unified OAuth callback for custom sign-in and sign-up flows:
// https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections
function SSOCallback() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const hasRun = React.useRef(false);

  React.useEffect(() => {
    if (!(clerk.loaded && signIn && signUp) || hasRun.current) {
      return;
    }
    hasRun.current = true;

    const callbackTicket = new URLSearchParams(window.location.search).get(
      "__clerk_ticket"
    );

    const buildErrorUrl = (qs: string) => {
      if (callbackTicket) {
        const sp = new URLSearchParams({ __clerk_ticket: callbackTicket });
        new URLSearchParams(qs).forEach((v, k) => {
          sp.set(k, v);
        });
        return `/sign-up/accept-invitation?${sp.toString()}`;
      }
      return `/sign-in${qs ? `?${qs}` : ""}`;
    };

    const handleMappedError = (err: unknown) => {
      const mapped = mapOAuthClerkError(err);
      if (mapped.kind === "redirect") {
        window.location.replace(mapped.target);
        return;
      }
      if (mapped.kind === "code") {
        window.location.replace(buildErrorUrl(`errorCode=${mapped.errorCode}`));
        return;
      }
      if (mapped.kind === "inline") {
        const params = new URLSearchParams({ error: mapped.message });
        window.location.replace(buildErrorUrl(params.toString()));
        return;
      }
      window.location.replace(buildErrorUrl(""));
    };

    const navigateAfterSession = makeFinalizeNavigate(SUCCESS_REDIRECT);

    const finalizeSignIn = () =>
      signIn.finalize({ navigate: navigateAfterSession });

    const finalizeSignUp = () =>
      signUp.finalize({ navigate: navigateAfterSession });

    const run = async () => {
      const inboundErr =
        signIn.firstFactorVerification?.error ??
        signUp.verifications?.externalAccount?.error;
      if (inboundErr) {
        handleMappedError(inboundErr);
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      if (signUp.isTransferable) {
        try {
          await signIn.create({ transfer: true });
        } catch (err) {
          handleMappedError(err);
          return;
        }
        const signInStatus = signIn.status as typeof signIn.status | "complete";
        if (signInStatus === "complete") {
          await finalizeSignIn();
          return;
        }
        window.location.replace("/sign-in");
        return;
      }

      if (
        signIn.status === "needs_first_factor" &&
        !signIn.supportedFirstFactors?.every(
          (f) => f.strategy === "enterprise_sso"
        )
      ) {
        window.location.replace("/sign-in");
        return;
      }

      if (signIn.isTransferable) {
        try {
          await signUp.create({ transfer: true, legalAccepted: true });
        } catch (err) {
          handleMappedError(err);
          return;
        }
        if (signUp.status === "complete") {
          await finalizeSignUp();
          return;
        }
        window.location.replace("/sign-up/continue");
        return;
      }

      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }

      if (
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_new_password"
      ) {
        window.location.replace("/sign-in");
        return;
      }

      const existingSessionId =
        signIn.existingSession?.sessionId ?? signUp.existingSession?.sessionId;
      if (existingSessionId) {
        await clerk.setActive({
          session: existingSessionId,
          navigate: navigateAfterSession,
        });
        return;
      }

      window.location.replace(buildErrorUrl(""));
    };

    void run();
  }, [clerk, signIn, signUp]);

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
      <Icons.spinner className="h-4 w-4 animate-spin" />
      <span>Signing in...</span>
      <div id="clerk-captcha" />
    </div>
  );
}

export default function Page() {
  return (
    <React.Suspense>
      <SSOCallback />
    </React.Suspense>
  );
}
