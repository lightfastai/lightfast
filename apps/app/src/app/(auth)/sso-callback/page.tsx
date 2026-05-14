"use client";

import { Icons } from "@repo/ui/components/icons";
import { useAuth, useClerk, useSignIn, useSignUp } from "@vendor/clerk/client";
import * as React from "react";
import { mapOAuthClerkError } from "../_hooks/auth-errors";

// Unified OAuth callback. Replaces the parallel sign-in/sso-callback and
// sign-up/sso-callback pages.
//
// Architecture: hybrid. We tried to follow Clerk's docs example which uses a
// pure Future-API state-machine walk (no clerk.handleRedirectCallback). On
// clerk-js@6.10.1 that pattern does NOT work — Clerk's hooks do NOT auto-
// hydrate signIn/signUp resources from the IdP callback URL, so the state
// walk runs on empty resources and bails to /sign-in. Verified empirically
// against Row 5 of the OAuth deep-test matrix (testuser@example.com via Test
// IdP). So we keep clerk.handleRedirectCallback as the processing step, and
// run the state walk only for cases it doesn't cover.
//
// Two Clerk quirks shape what comes after:
//
// 1. handleRedirectCallback does NOT throw on rejections. clerk-react wraps
//    the underlying call in `.catch(() => {})` (see @clerk/react@6.5.0 dist
//    line 3258). Rejections are pinned to
//    clerk.client.signIn.firstFactorVerification.error or
//    clerk.client.signUp.verifications.externalAccount.error — inspect after
//    the await. On success it navigates internally and our post-await code
//    never runs.
//
// 2. We pass legalAccepted:true to signUp.sso() at init, but if the IdP
//    roundtrip returns with status=missing_requirements + missing=[legal_
//    accepted], the patch didn't stick — likely the in-flight resource patch
//    bug family. We reconcile via Future API signUp.update({legalAccepted})
//    here; if that no-ops in practice we'll see a Row 7 dead-end and fall
//    back to clerk.client.signUp.update.
//
// __clerk_ticket preservation: /sign-up/accept-invitation uses legacy
// authenticateWithRedirect and tags __clerk_ticket on the callback URL. On
// error we route back to /sign-up/accept-invitation so the ticket UI
// re-mounts with a banner rather than dropping into /sign-in.
function SSOCallback() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  // useAuth().isLoaded is the reactive load signal. useSignIn/useSignUp on
  // the Future API don't expose isLoaded; clerk.loaded is not reactive
  // (useClerk returns a stable singleton ref). useAuth IS reactive and
  // matches the legacy callback's gating pattern.
  const { isLoaded } = useAuth();
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) {
      return;
    }
    if (!(isLoaded && signIn && signUp)) {
      return;
    }
    started.current = true;

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

    const finalizeSignUp = () =>
      signUp.finalize({
        navigate: async ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            return;
          }
          const url = decorateUrl("/account/welcome");
          window.location.href = url;
        },
      });

    // Future API reconciliation. signUp.update mutates the in-flight
    // resource; signUp.finalize then runs setActive + navigate for us.
    // Returns true if it closed the resource and navigated; false if caller
    // should fall through. If this no-ops in practice (suspected per
    // pre-strip notes — the in-flight resource patch bug family), Row 7 will
    // dead-end and we'll re-introduce clerk.client.signUp.update here.
    const reconcileLegalAcceptedThenFinalize = async (): Promise<boolean> => {
      try {
        await signUp.update({ legalAccepted: true });
        if (signUp.status === "complete") {
          await finalizeSignUp();
          return true;
        }
      } catch {
        // fall through
      }
      return false;
    };

    const needsLegalAcceptedOnly = () =>
      signUp.status === "missing_requirements" &&
      signUp.missingFields?.length === 1 &&
      signUp.missingFields[0] === "legal_accepted" &&
      signUp.verifications?.externalAccount?.status === "verified";

    const run = async () => {
      // Step 1: process the IdP callback. Two empirical quirks shape this:
      //
      //   a. handleRedirectCallback never resolves in scenarios where Clerk
      //      has nothing to navigate to (e.g. a pending session post-
      //      completion, or a reload with no IdP params on the URL). The
      //      old callbacks didn't see this because they sat under
      //      isAuthRoute middleware which redirected authenticated users to
      //      /account/welcome before the page could re-enter handleRedirect.
      //      Our /sso-callback is isPublicRoute, so we race the await against
      //      a timeout and drive nav ourselves below.
      //   b. handleRedirectCallback swallows rejections in clerk-react@6 (see
      //      docstring at top of file). Errors are pinned to resource state
      //      and inspected post-await.
      //
      // Resources still hydrate even when the promise hangs — Clerk's
      // /v1/client/sign_ins POST fires immediately and updates state via
      // its event bus. So by the time the timeout fires, clerk.user,
      // signIn.status, etc. are populated.
      await Promise.race([
        clerk
          .handleRedirectCallback({
            signInFallbackRedirectUrl: "/account/welcome",
            signUpFallbackRedirectUrl: "/account/welcome",
            continueSignUpUrl: "/sign-in?errorCode=account_not_found",
          })
          .catch(() => {
            // Per quirk b, .catch() rarely fires anyway.
          }),
        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
      ]);

      // Step 2: surface waitlist / inline rejections.
      const inboundErr =
        signIn.firstFactorVerification?.error ??
        signUp.verifications?.externalAccount?.error;
      if (inboundErr) {
        handleMappedError(inboundErr);
        return;
      }

      // Step 3: if user is signed in (any session status), drive nav to
      // /account/welcome. Onboarding handles pending sessions (currentTask)
      // there. Hard nav via .href because we want a fresh page load.
      if (clerk.user) {
        window.location.href = "/account/welcome";
        return;
      }

      // Step 4: legal_accepted reconciliation for sign-ups that landed here
      // with everything except legal_accepted (sso() init patch didn't stick
      // — bug family with in-flight resources).
      if (
        needsLegalAcceptedOnly() &&
        (await reconcileLegalAcceptedThenFinalize())
      ) {
        return;
      }

      // Nothing matched — bail to a clean form.
      window.location.replace(buildErrorUrl(""));
    };

    void run();
  }, [isLoaded, signIn, signUp, clerk]);

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
      <Icons.spinner className="h-4 w-4 animate-spin" />
      <span>Signing in...</span>
      {/* Required when a sign-in transfers to a sign-up — Clerk renders the
          bot-protection captcha here. */}
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
