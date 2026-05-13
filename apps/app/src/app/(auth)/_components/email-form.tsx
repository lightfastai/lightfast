"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useSignIn, useSignUp } from "@vendor/clerk/client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { mapOtpClerkError } from "../_hooks/auth-errors";
import { authBreadcrumb, authSpan } from "../_hooks/auth-telemetry";
import {
  serializeSignInParams,
  serializeSignUpParams,
} from "../_lib/search-params";

interface EmailFormProps {
  action: "sign-in" | "sign-up";
  ticket?: string | null;
}

// Submit calls Clerk inline (signIn.emailCode.sendCode / signUp.create +
// sendEmailCode) BEFORE navigating to ?step=code. Errors land on the same
// page with ?errorCode= or ?error=, never on the OTP screen — so the user
// never sees the OTP UI flash before bouncing to a waitlist / not-found
// banner. OTPIsland's init effect detects the pre-primed in-flight resource
// and skips its own send (see use-auth-flow.ts).
export function EmailForm({ action, ticket }: EmailFormProps) {
  const router = useRouter();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const errorPathFor = React.useCallback(
    (params: { errorCode?: string; error?: string }) => {
      const base = action === "sign-in" ? "/sign-in" : "/sign-up";
      const search = new URLSearchParams();
      if (action === "sign-up" && ticket) {
        search.set("__clerk_ticket", ticket);
      }
      if (params.errorCode) {
        search.set("errorCode", params.errorCode);
      } else if (params.error) {
        search.set("error", params.error);
      }
      return `${base}?${search.toString()}`;
    },
    [action, ticket]
  );

  const handleError = React.useCallback(
    (err: unknown) => {
      const mapped = mapOtpClerkError(err);
      if (mapped.kind === "redirect") {
        // session_exists → /account/welcome (cross-app — hard nav).
        window.location.href = mapped.target;
        return;
      }
      // .replace on errors: user just submitted, there is no useful prior
      // entry to back into (the EmailForm-with-submitting state is gone).
      if (mapped.kind === "code") {
        window.location.replace(errorPathFor({ errorCode: mapped.errorCode }));
        return;
      }
      if (mapped.kind === "inline") {
        window.location.replace(errorPathFor({ error: mapped.message }));
        return;
      }
      window.location.replace(errorPathFor({ error: "Authentication failed" }));
    },
    [errorPathFor]
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);

    try {
      if (action === "sign-in") {
        const { error: sendError } = await authSpan(
          "auth.otp.send",
          { mode: "sign-in" },
          () => signIn.emailCode.sendCode({ emailAddress: trimmed })
        );
        if (sendError) {
          authBreadcrumb("Email submit rejected", "warning", {
            mode: "sign-in",
            code: sendError.code,
          });
          handleError(sendError);
          return;
        }
        authBreadcrumb("OTP code sent (from EmailForm)", "info", {
          mode: "sign-in",
        });
        router.push(
          serializeSignInParams("/sign-in", { step: "code", email: trimmed })
        );
        return;
      }

      // sign-up — ticket and non-ticket share the same shape post-create.
      const createRes = ticket
        ? await authSpan("auth.ticket.create", { mode: "sign-up" }, () =>
            signUp.create({
              strategy: "ticket",
              ticket,
              emailAddress: trimmed,
              legalAccepted: true,
            })
          )
        : await authSpan("auth.signup.create", { mode: "sign-up" }, () =>
            signUp.create({
              emailAddress: trimmed,
              legalAccepted: true,
            })
          );
      if (createRes.error) {
        authBreadcrumb("Email submit rejected", "warning", {
          mode: "sign-up",
          code: createRes.error.code,
        });
        handleError(createRes.error);
        return;
      }

      // Ticket consume can complete immediately if the invitation auto-creates
      // a session. Finalize so cookies decorate correctly (Safari ITP).
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: async ({ decorateUrl }) => {
            window.location.href = decorateUrl("/account/welcome");
          },
        });
        return;
      }

      const { error: sendError } = await authSpan(
        "auth.otp.send",
        { mode: "sign-up" },
        () => signUp.verifications.sendEmailCode()
      );
      if (sendError) {
        authBreadcrumb("OTP send rejected", "warning", {
          mode: "sign-up",
          code: sendError.code,
        });
        handleError(sendError);
        return;
      }

      authBreadcrumb("OTP code sent (from EmailForm)", "info", {
        mode: "sign-up",
      });
      router.push(
        serializeSignUpParams("/sign-up", {
          step: "code",
          email: trimmed,
          ticket: ticket ?? null,
        })
      );
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Input
        autoComplete="email"
        className="bg-background dark:bg-background"
        disabled={submitting}
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email Address"
        required
        size="lg"
        type="email"
        value={email}
      />
      <Button className="w-full" disabled={submitting} size="lg" type="submit">
        {submitting ? (
          <Icons.spinner className="h-4 w-4 animate-spin" />
        ) : (
          "Continue with Email"
        )}
      </Button>
    </form>
  );
}
