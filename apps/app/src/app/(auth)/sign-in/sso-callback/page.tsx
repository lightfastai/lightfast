"use client";

import { AuthenticateWithRedirectCallback } from "@vendor/clerk/client";

const ACCOUNT_NOT_FOUND_URL = "/sign-in?errorCode=account_not_found";

export default function Page() {
  // Handle the redirect flow by calling the Clerk.handleRedirectCallback() method
  // or rendering the prebuilt <AuthenticateWithRedirectCallback/> component.
  // This is the final step in the custom OAuth flow.
  //
  // Clerk's task system handles redirection:
  // - Active users (with org) → signInFallbackRedirectUrl → /account/welcome → /:orgSlug
  // - Unregistered GitHub account → continueSignUpUrl → /sign-in?error=...&accountNotFound=true

  return (
    <AuthenticateWithRedirectCallback
      continueSignUpUrl={ACCOUNT_NOT_FOUND_URL}
      signInFallbackRedirectUrl="/account/welcome"
      signUpFallbackRedirectUrl="/account/welcome"
    />
  );
}
