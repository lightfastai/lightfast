import { PropsWithChildren } from "react";
import { getClerkInstance } from "@/lib/clerk";
import {
  ClerkProp,
  ClerkProvider,
  ClerkProviderProps,
} from "@clerk/clerk-react";

export const HubClerkProvider = ({ children }: PropsWithChildren) => {
  const clerkProps: Partial<ClerkProviderProps> = {
    publishableKey: `${import.meta.env.VITE_PUBLIC_CLERK_PUBLISHABLE_KEY}`,
    signInUrl: "/signin",
    signUpUrl: "/signup",
    // allowedRedirectOrigins: ["clerk://local.hub.electron.vite"],
  };

  if (import.meta.env.VITE_PUBLIC_CLERK_PUBLISHABLE_KEY.match("http")) {
    clerkProps.Clerk = getClerkInstance({
      publishableKey: import.meta.env.VITE_PUBLIC_CLERK_PUBLISHABLE_KEY,
    }) as unknown as ClerkProp;
  }

  return (
    <ClerkProvider {...(clerkProps as ClerkProviderProps)}>
      {children}
    </ClerkProvider>
  );
};
