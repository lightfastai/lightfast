"use client";

import {
  AuthenticateWithRedirectCallback,
  useSignUp,
} from "@vendor/clerk/client";
import { useSearchParams } from "next/navigation";
import * as React from "react";

function SSOCallback() {
  const { signUp } = useSignUp();
  const searchParams = useSearchParams();
  const clerkTicket = searchParams.get("__clerk_ticket");
  const updateStarted = React.useRef(false);

  React.useEffect(() => {
    if (!(clerkTicket && signUp) || updateStarted.current) return;
    if (signUp.status !== "missing_requirements") return;
    const missing = signUp.missingFields ?? [];
    if (
      missing.length !== 1 ||
      missing[0] !== "legal_accepted" ||
      signUp.verifications?.externalAccount?.status !== "verified"
    ) return;
    updateStarted.current = true;
    signUp.update({ legalAccepted: true }).catch(() => {
      updateStarted.current = false;
    });
  }, [signUp, clerkTicket]);

  React.useEffect(() => {
    if (!(updateStarted.current && signUp) || signUp.status !== "complete") return;
    signUp
      .finalize({ navigate: async () => { window.location.href = "/account/welcome"; } })
      .catch(() => {});
  }, [signUp]);

  return (
    <AuthenticateWithRedirectCallback
      continueSignUpUrl={clerkTicket ? null : "/sign-up"}
      signInFallbackRedirectUrl="/account/welcome"
      signUpFallbackRedirectUrl="/account/welcome"
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
