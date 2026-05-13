"use client";

import {
  AuthenticateWithRedirectCallback,
  useSignUp,
} from "@vendor/clerk/client";
import * as React from "react";

function SSOCallback() {
  const { signUp } = useSignUp();
  const updateStarted = React.useRef(false);

  // After AuthenticateWithRedirectCallback processes the OAuth callback, if only
  // legal_accepted is missing (the expected state for OAuth sign-up — Clerk
  // derives email from the external account), apply it inline.
  // continueSignUpUrl={null} keeps this page mounted so the effect runs.
  React.useEffect(() => {
    if (!signUp || updateStarted.current) {
      return;
    }
    if (signUp.status !== "missing_requirements") {
      return;
    }

    const missing = signUp.missingFields ?? [];
    if (
      missing.length !== 1 ||
      missing[0] !== "legal_accepted" ||
      signUp.verifications?.externalAccount?.status !== "verified"
    ) {
      return;
    }

    updateStarted.current = true;
    signUp.update({ legalAccepted: true }).catch(() => {
      updateStarted.current = false;
    });
  }, [signUp]);

  // Finalize once the sign-up reaches "complete" after our update. Runs in a
  // separate cycle so it reads the fresh reactive signUp from Core 3 Signals.
  React.useEffect(() => {
    if (!(updateStarted.current && signUp) || signUp.status !== "complete") {
      return;
    }

    signUp
      .finalize({
        navigate: async () => {
          window.location.href = "/account/welcome";
        },
      })
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional error swallow — Clerk finalize can fail silently
      .catch(() => {});
  }, [signUp]);

  return (
    <AuthenticateWithRedirectCallback
      // continueSignUpUrl={null} prevents Clerk from navigating away to
      // /sign-up when status is missing_requirements. Without this, non-ticket
      // OAuth sign-ups dead-end on /sign-up (no UI handles the in-flight
      // signUp resource there). Our effects apply legal_accepted + finalize.
      // Applies to both invitation-ticket and no-ticket OAuth sign-up.
      continueSignUpUrl={null}
      signInFallbackRedirectUrl={"/account/welcome"}
      signUpFallbackRedirectUrl={"/account/welcome"}
    />
  );
}

export default function Page() {
  return (
    <React.Suspense>
      <SSOCallback />
    </React.Suspense>
  );
}
