import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

// This page handles OAuth callbacks and must be dynamic
export const dynamic = 'force-dynamic'

export default function Page() {
  // Handle the redirect flow by calling the Clerk.handleRedirectCallback() method
  // or rendering the prebuilt <AuthenticateWithRedirectCallback/> component.
  // This is the final step in the custom OAuth flow.
  return <AuthenticateWithRedirectCallback />
}
