"use client";

import { AuthenticateWithRedirectCallback, useSignUp } from "@vendor/clerk/client";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { consoleUrl } from "~/lib/related-projects";

function SSOCallback() {
  const { signUp } = useSignUp();
  const searchParams = useSearchParams();
  const clerkTicket = searchParams.get("__clerk_ticket");
  const updateStarted = React.useRef(false);

  // Effect 1: After AuthenticateWithRedirectCallback processes the OAuth callback,
  // if only legal_accepted is missing (expected for invite + GitHub flow), apply it
  // inline without navigating away. continueSignUpUrl={null} keeps this page mounted.
  React.useEffect(() => {
    if (!clerkTicket || !signUp || updateStarted.current) return;
    if (signUp.status !== "missing_requirements") return;

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
  }, [signUp, clerkTicket]);

  // Effect 2: Finalize once the sign-up reaches "complete" after our update.
  // Runs in a separate cycle so it reads the fresh reactive signUp from Core 3 Signals.
  React.useEffect(() => {
    if (!updateStarted.current || !signUp || signUp.status !== "complete") return;

    signUp
      .finalize({
        navigate: async () => {
          window.location.href = `${consoleUrl}/account/welcome`;
        },
      })
      .catch(() => {});
  }, [signUp]);

  return (
    <AuthenticateWithRedirectCallback
      // Invite flow: continueSignUpUrl={null} prevents Clerk from navigating away
      // when status is missing_requirements. Our effects handle legal_accepted inline.
      // Non-invite flow: not reached (no ticket → no sign-up callback here).
      continueSignUpUrl={clerkTicket ? null : "/sign-up"}
      signInFallbackRedirectUrl={`${consoleUrl}/account/welcome`}
      signUpFallbackRedirectUrl={`${consoleUrl}/account/welcome`}
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
