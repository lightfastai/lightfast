import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

export const SSOCallback = () => {
  // Handle the redirect flow by rendering the
  // prebuilt AuthenticateWithRedirectCallback component.
  // This is the final step in the custom OAuth flow
  const environment = window.Clerk?.__unstable__environment;
  if (environment?.displayConfig) {
    environment.displayConfig.afterSignInUrl = `/`;
    environment.displayConfig.afterSignUpUrl = `/`;
    environment.displayConfig.signUpUrl = `/signUp`;
    environment.displayConfig.signInUrl = `/signIn`;

    window.Clerk?.updateEnvironment(environment);
  }

  return <AuthenticateWithRedirectCallback />;
};
