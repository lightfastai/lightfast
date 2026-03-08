export {
  AuthenticateWithRedirectCallback,
  ClerkDegraded,
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  RedirectToCreateOrganization,
  RedirectToOrganizationProfile,
  RedirectToSignIn,
  RedirectToSignUp,
  RedirectToTasks,
  RedirectToUserProfile,
} from "@clerk/nextjs";

export {
  APIKeys,
  CreateOrganization,
  GoogleOneTap,
  OrganizationList,
  OrganizationProfile,
  OrganizationSwitcher,
  PricingTable,
  SignIn,
  SignInButton,
  SignInWithMetamaskButton,
  SignOutButton,
  SignUp,
  SignUpButton,
  TaskChooseOrganization,
  TaskResetPassword,
  UserAvatar,
  UserButton,
  UserProfile,
  Waitlist,
} from "@clerk/nextjs";

export {
  useAuth,
  useClerk,
  useEmailLink,
  useOrganization,
  useOrganizationCreationDefaults,
  useOrganizationList,
  useReverification,
  useSession,
  useSessionList,
  useUser,
} from "@clerk/nextjs";

// useSignIn and useSignUp use the legacy programmatic API (Core 3 replaced with components-based API)
export { useSignIn, useSignUp } from "@clerk/nextjs/legacy";

export { ClerkProvider, Show } from "@clerk/nextjs";
