"use client";

import { Icons } from "@repo/ui/components/icons";
import { useClerk, useSignIn, useSignUp } from "@vendor/clerk/client";
import * as React from "react";
import { mapOAuthClerkError } from "../_hooks/auth-errors";

const SUCCESS_REDIRECT = "/account/welcome";

// Unified OAuth callback. Mirrors Clerk's Future-API reference:
// https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections
//
// The effect re-runs as signIn/signUp resources hydrate from the IdP callback
// URL; hasRun gates the state machine to one pass.
//
// __clerk_ticket preservation: /sign-up/accept-invitation appends the ticket
// to its callback URL. On error we route back to accept-invitation so the
// ticket UI re-mounts with a banner instead of dropping into /sign-in.
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

    const navigateAfterSession = (params: {
      session?: { currentTask?: unknown } | null;
      decorateUrl: (u: string) => string;
    }) => {
      if (params.session?.currentTask) {
        return;
      }
      window.location.href = params.decorateUrl(SUCCESS_REDIRECT);
    };

    const finalizeSignIn = () =>
      signIn.finalize({ navigate: navigateAfterSession });

    const finalizeSignUp = () =>
      signUp.finalize({ navigate: navigateAfterSession });

    const run = async () => {
      // Resource-level rejections (waitlist, etc.) land on the verification
      // objects rather than throwing — inspect before walking happy branches.
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

      // Sign-up's external account matched an existing user — transfer it
      // back into a sign-in.
      if (signUp.isTransferable) {
        try {
          await signIn.create({ transfer: true });
        } catch (err) {
          handleMappedError(err);
          return;
        }
        // signIn.create() can flip status to "complete", but the static type
        // doesn't widen after the await. Cast per Clerk's reference.
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

      // Sign-in's external account isn't tied to a user — transfer it into
      // a sign-up.
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

      // External account already active on this client — switch the session
      // instead of finalizing a sign-in/up.
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
