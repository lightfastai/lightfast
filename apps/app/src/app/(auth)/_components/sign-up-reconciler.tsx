"use client";

import { useClerk, useSignUp } from "@vendor/clerk/client";
import * as React from "react";

// Mounted on /sign-up. After an OAuth round-trip lands here with an in-flight
// signUp resource that only needs legal_accepted (the expected post-OAuth
// state when the external account is verified), apply it inline and finalize.
//
// Why this lives on /sign-up and not /sign-up/sso-callback: Clerk's
// AuthenticateWithRedirectCallback navigates the user to its
// continueSignUpUrl when status==="missing_requirements" — and as of
// clerk-react v6 the `continueSignUpUrl={null}` opt-out is silently
// ignored. So the callback page can't catch the reconciliation; only
// /sign-up itself can.
export function SignUpReconciler(): null {
  const { signUp } = useSignUp();
  const clerk = useClerk();
  const updateStarted = React.useRef(false);

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
    // The Future API signUp.update({legalAccepted}) resolves with error:null
    // but does NOT actually mutate the underlying SignUp resource (status
    // stays "missing_requirements" forever). Same family of bug as the Future
    // API signIn.ticket() no-op documented at use-auth-flow.ts:558-572. Drop
    // to the legacy clerk.client.signUp.update(...) — which actually PATCHes
    // the resource — then promote via clerk.setActive and redirect.
    clerk.client.signUp
      .update({ legalAccepted: true })
      .then(async (updated) => {
        if (updated.status !== "complete") {
          return;
        }
        if (updated.createdSessionId) {
          await clerk.setActive({ session: updated.createdSessionId });
        }
        window.location.href = "/account/welcome";
      })
      .catch(() => {
        updateStarted.current = false;
      });
  }, [signUp, clerk]);

  return null;
}
