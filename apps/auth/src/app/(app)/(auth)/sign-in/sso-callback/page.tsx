import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

export default function Page() {
  // Handle the redirect flow by calling the Clerk.handleRedirectCallback() method
  // or rendering the prebuilt <AuthenticateWithRedirectCallback/> component.
  // This is the final step in the custom OAuth flow.
  //
  // Clerk's task system handles redirection:
  // - Pending users (no org) → taskUrls["choose-organization"] → /account/teams/new
  // - Active users (with org) → signInFallbackRedirectUrl → console
  return <AuthenticateWithRedirectCallback />
}