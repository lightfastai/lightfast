"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedOrigin } from "~/cors";
import { serializeSignInParams } from "../_lib/search-params";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// `redirect_url` is attacker-controlled (URL query → FormData). Allow only:
//   - app-relative paths starting with "/" (rejecting "//" to block
//     protocol-relative cross-origin redirects);
//   - absolute URLs whose origin is in the same allowlist used by CORS — this
//     covers the desktop sign-in handoff which legitimately passes
//     https://lightfast(.localhost)/desktop/auth?... back through the flow.
function getRedirectUrl(formData: FormData): string | null {
  const value = formData.get("redirect_url");
  if (typeof value !== "string" || !value) {
    return null;
  }
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  try {
    const url = new URL(value);
    return isAllowedOrigin(url.origin) ? value : null;
  } catch {
    return null;
  }
}

export async function initiateSignIn(formData: FormData) {
  const redirectUrl = getRedirectUrl(formData);
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email";
    redirect(
      serializeSignInParams("/sign-in", {
        error: message,
        redirect_url: redirectUrl,
      })
    );
  }

  // Email validated. Redirect to OTP step — the client island will call
  // signIn.emailCode.sendCode() via Clerk's FAPI.
  redirect(
    serializeSignInParams("/sign-in", {
      step: "code",
      email: parsed.data.email,
      redirect_url: redirectUrl,
    })
  );
}
