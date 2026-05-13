"use client";

import { Icons } from "@repo/ui/components/icons";
import { useAuth, useClerk } from "@vendor/clerk/client";
import * as React from "react";
import { mapOAuthClerkError } from "../../_hooks/auth-errors";

// Custom OAuth callback handler. Mirrors sign-in/sso-callback. We call
// clerk.handleRedirectCallback() directly (instead of
// <AuthenticateWithRedirectCallback>) so we can:
//
// 1. Route rejections that the prebuilt component swallows — notably
//    sign_up_restricted_waitlist when waitlist mode is on.
// 2. Apply the missing legal_accepted field inline. For OAuth sign-up Clerk
//    derives the email from the verified external account, so the only
//    missing field once the IdP returns is legal_accepted. We previously had
//    a separate <SignUpReconciler /> mounted on /sign-up to do this — that
//    only existed because <AuthenticateWithRedirectCallback> navigates the
//    user away to continueSignUpUrl on missing_requirements and the
//    `continueSignUpUrl={null}` opt-out is silently ignored as of
//    clerk-react v6. With manual handleRedirectCallback there is no premature
//    navigation, so we reconcile right here.
//
// Two Clerk quirks shape this code:
//
// (a) useClerk() returns a stable singleton; clerk.loaded flips false→true
//     but the object reference doesn't change. A useEffect with [clerk] deps
//     would only fire on mount and miss hydration. We gate on
//     useAuth().isLoaded which is reactive.
// (b) handleRedirectCallback does NOT throw on rejections. clerk-react wraps
//     the underlying call in `.catch(() => {})` (see @clerk/react@6.5.0
//     dist line 3258). Rejections are left pinned to
//     clerk.client.signIn.firstFactorVerification.error or
//     clerk.client.signUp.verifications.externalAccount.error — inspect
//     after the await.
// (c) The Future API signUp.update({legalAccepted}) is a no-op against the
//     in-flight resource (same family of bug as signIn.ticket/sso). Drop
//     to legacy clerk.client.signUp.update for the patch.
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
          // Pin to this page so we can reconcile legal_accepted ourselves.
          // Clerk's default would navigate to /sign-up on
          // missing_requirements before we get a chance.
          continueSignUpUrl: null,
        });
      } catch {
        // handleRedirectCallback rarely throws — fall through to inspection.
      }

      const signIn = clerk.client?.signIn;
      const signUp = clerk.client?.signUp;

      // Surface waitlist / inline rejections first.
      const err =
        signIn?.firstFactorVerification?.error ??
        signUp?.verifications?.externalAccount?.error;
      // .replace() on error paths so browser-back from the destination
      // doesn't re-enter the terminal sso-callback and bounce forward again.
      if (err) {
        const mapped = mapOAuthClerkError(err);
        if (mapped.kind === "redirect") {
          window.location.replace(mapped.target);
          return;
        }
        if (mapped.kind === "code") {
          window.location.replace(`/sign-up?errorCode=${mapped.errorCode}`);
          return;
        }
        if (mapped.kind === "inline") {
          const params = new URLSearchParams({ error: mapped.message });
          window.location.replace(`/sign-up?${params.toString()}`);
          return;
        }
        window.location.replace("/sign-up");
        return;
      }

      // Reconcile legal_accepted inline. Only the canonical OAuth sign-up
      // shape (external account verified, single missing field) is handled
      // here — anything else falls through to /sign-up cleanly.
      if (
        signUp &&
        signUp.status === "missing_requirements" &&
        signUp.missingFields?.length === 1 &&
        signUp.missingFields[0] === "legal_accepted" &&
        signUp.verifications?.externalAccount?.status === "verified"
      ) {
        try {
          const updated = await clerk.client.signUp.update({
            legalAccepted: true,
          });
          if (updated.status === "complete" && updated.createdSessionId) {
            await clerk.setActive({ session: updated.createdSessionId });
            // Success path: hard-nav (.href) is fine — we want the new page
            // loaded fresh, not as a history-stack replacement.
            window.location.href = "/account/welcome";
            return;
          }
        } catch {
          // Fall through to the clean reset below.
        }
      }

      window.location.replace("/sign-up");
    };

    void run();
  }, [isLoaded, clerk]);

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
      <Icons.spinner className="h-4 w-4 animate-spin" />
      <span>Creating your account...</span>
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
