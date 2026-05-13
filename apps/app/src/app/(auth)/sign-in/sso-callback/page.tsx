"use client";

import { useAuth, useClerk } from "@vendor/clerk/client";
import * as React from "react";
import { mapOAuthClerkError } from "../../_hooks/auth-errors";

// Custom OAuth callback handler. We call clerk.handleRedirectCallback()
// directly (instead of <AuthenticateWithRedirectCallback>) so we can route
// rejections that the prebuilt component swallows — notably
// sign_up_restricted_waitlist when waitlist mode is on and the OAuth identity
// has no matching Lightfast user.
//
// Two Clerk quirks shape this code:
//
// 1. useClerk() returns a stable singleton; clerk.loaded flips from false to
//    true but the object reference doesn't change. A useEffect with [clerk]
//    deps would only fire on mount and miss the hydration. We gate on
//    useAuth().isLoaded, which IS reactive.
// 2. handleRedirectCallback does NOT throw on rejections. clerk-react wraps
//    the underlying call in `.catch(() => {})` and voids the return value
//    (see @clerk/react@6.5.0 dist line 3258). The rejection is left pinned
//    to clerk.client.signIn.firstFactorVerification.error (or
//    signUp.verifications.externalAccount.error). On success it internally
//    navigates and our post-await code never runs (page unmounts). So we
//    inspect resource state after the await — the only execution path that
//    reaches it is the rejection case.
//
// The sticky-no-op recovery (calling reset() before the *next* sso() attempt
// so it actually issues network traffic) lives in useAuthFlow — it has to
// happen at the point of retry, not here, because a full page navigation
// re-hydrates the signIn resource from cookies and wipes any in-memory reset
// we'd do on this page.
function SSOCallback() {
  const clerk = useClerk();
  const { isLoaded } = useAuth();
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current || !isLoaded) {
      return;
    }
    started.current = true;

    const run = async () => {
      try {
        await clerk.handleRedirectCallback({
          signInFallbackRedirectUrl: "/account/welcome",
          signUpFallbackRedirectUrl: "/account/welcome",
          continueSignUpUrl: "/sign-in?errorCode=account_not_found",
        });
      } catch {
        // handleRedirectCallback rarely throws, but if it does, fall through
        // to the post-call inspection so we still try to map the error.
      }

      const signInErr = clerk.client?.signIn?.firstFactorVerification?.error;
      const signUpErr =
        clerk.client?.signUp?.verifications?.externalAccount?.error;
      const err = signInErr ?? signUpErr;

      if (!err) {
        // No error and no navigation happened — unexpected. Bail to a clean
        // sign-in form rather than leave the user on a blank callback page.
        window.location.href = "/sign-in";
        return;
      }

      const mapped = mapOAuthClerkError(err);
      if (mapped.kind === "redirect") {
        window.location.href = mapped.target;
        return;
      }
      if (mapped.kind === "code") {
        window.location.href = `/sign-in?errorCode=${mapped.errorCode}`;
        return;
      }
      if (mapped.kind === "inline") {
        const params = new URLSearchParams({ error: mapped.message });
        window.location.href = `/sign-in?${params.toString()}`;
        return;
      }
      window.location.href = "/sign-in";
    };

    void run();
  }, [isLoaded, clerk]);

  return null;
}

export default function Page() {
  return (
    <React.Suspense>
      <SSOCallback />
    </React.Suspense>
  );
}
