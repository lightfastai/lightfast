import { useCallback } from "react";

import { useAuth, useClerk } from "@vendor/clerk/react";

/**
 * Custom hook to interact with Clerk authentication in Electron
 * Handles authentication state persistence between app sessions
 */
export function useElectronAuth() {
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();

  // Save authentication token to Electron's session
  const persistToken = useCallback(async () => {
    // This is a simplified version - in a real app, you would
    // extract the actual token and expiry from Clerk's session
    try {
      const token = localStorage.getItem("__clerk_client_jwt") || "";
      if (token) {
        // Set expiry to 7 days from now (in seconds)
        const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        window.authAPI.saveToken(token, expiry);
      }
    } catch (error) {
      console.error("Failed to persist auth token:", error);
    }
  }, []);

  // Handle user logout
  const handleSignOut = useCallback(async () => {
    try {
      // First clear the session in Electron
      window.authAPI.clearAuth();
      // Then sign out from Clerk
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, [signOut]);

  return {
    isSignedIn,
    isLoaded,
    persistToken,
    signOut: handleSignOut,
  };
}
