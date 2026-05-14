"use client";

import { Icons } from "@repo/ui/components/icons";
import { useClerk, useSignUp } from "@vendor/clerk/client";
import * as React from "react";

const SUCCESS_REDIRECT = "/account/welcome";

// Landing for /sso-callback's `signIn.isTransferable` branch when the
// transferred sign-up surfaces missing_requirements. We only expect
// `legal_accepted` here (the sole required-at-create field in our tenant
// config); any other missing field is treated as unsupported.
function SignUpContinue() {
  const clerk = useClerk();
  const { signUp } = useSignUp();
  const hasRun = React.useRef(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!(clerk.loaded && signUp) || hasRun.current) {
      return;
    }
    hasRun.current = true;

    const navigateAfterSession = (params: {
      session?: { currentTask?: unknown } | null;
      decorateUrl: (u: string) => string;
    }) => {
      if (params.session?.currentTask) {
        return;
      }
      window.location.href = params.decorateUrl(SUCCESS_REDIRECT);
    };

    const run = async () => {
      if (signUp.status === "complete") {
        await signUp.finalize({ navigate: navigateAfterSession });
        return;
      }

      const missing = signUp.missingFields ?? [];
      const onlyLegalMissing =
        missing.length === 1 && missing[0] === "legal_accepted";
      if (!onlyLegalMissing) {
        const params = new URLSearchParams({
          error: "Sign-up needs more information. Start over from /sign-up.",
        });
        window.location.replace(`/sign-up?${params.toString()}`);
        return;
      }

      try {
        const { error: updateError } = await signUp.update({
          legalAccepted: true,
        });
        if (updateError) {
          setError("Couldn't complete sign-up. Please try again.");
          return;
        }
      } catch {
        setError("Couldn't complete sign-up. Please try again.");
        return;
      }

      // signUp.update() can flip status to "complete", but the static type
      // doesn't widen after the await. Cast per Clerk's reference.
      const signUpStatus = signUp.status as typeof signUp.status | "complete";
      if (signUpStatus === "complete") {
        await signUp.finalize({ navigate: navigateAfterSession });
        return;
      }

      const params = new URLSearchParams({
        error: "Sign-up didn't complete. Start over from /sign-up.",
      });
      window.location.replace(`/sign-up?${params.toString()}`);
    };

    void run();
  }, [clerk, signUp]);

  if (error) {
    return (
      <div className="w-full max-w-md space-y-2 text-center">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
      <Icons.spinner className="h-4 w-4 animate-spin" />
      <span>Finishing sign-up...</span>
      <div id="clerk-captcha" />
    </div>
  );
}

export default function Page() {
  return (
    <React.Suspense>
      <SignUpContinue />
    </React.Suspense>
  );
}
