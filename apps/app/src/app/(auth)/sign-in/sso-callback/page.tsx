"use client";

import { AuthenticateWithRedirectCallback } from "@vendor/clerk/client";

const ACCOUNT_NOT_FOUND_URL = "/sign-in?errorCode=account_not_found";

export default function Page() {
  return (
    <AuthenticateWithRedirectCallback
      continueSignUpUrl={ACCOUNT_NOT_FOUND_URL}
      signInFallbackRedirectUrl="/account/welcome"
      signUpFallbackRedirectUrl="/account/welcome"
    />
  );
}
