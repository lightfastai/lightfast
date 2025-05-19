import { useEffect } from "react";
import { createClient } from "@openauthjs/openauth/client";

import { $SessionType } from "@vendor/openauth";

import { setTokensElectronHandler } from "../helpers/auth-helpers";

// Declare the types for the electron context bridge API
declare global {
  interface Window {
    electron?: {
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      auth: {
        onAuthCallback: (callback: (url: string) => void) => () => void;
      };
    };
  }
}

export const client = createClient({
  clientID: "nextjs", // @TODO what should this be?
  issuer: "http://localhost:3001",
});

type AuthCallbackHandler = (session: any | null, error: string | null) => void;

// This is the singleton hook that should only be used once in the app
export function useAuthCallback(onAuthResult: AuthCallbackHandler) {
  useEffect(() => {
    if (!window.electron?.auth?.onAuthCallback) {
      console.error("Auth callback registration not available");
      return;
    }

    console.log("Registering auth callback handler");

    // Track processed URLs to prevent double handling
    const processedUrls = new Set<string>();

    // Register auth callback handler
    const removeListener = window.electron.auth.onAuthCallback(
      async (url: string) => {
        try {
          console.log("Received auth callback:", url);

          // Check if this URL was already processed
          if (processedUrls.has(url)) {
            console.log("Already processed this URL, skipping:", url);
            return;
          }

          // Mark URL as processed
          processedUrls.add(url);

          const parsed = new URL(url);
          const redirectUri = "lightfast://auth/callback";

          // Handle redirect with tokens in URL (new flow)
          const accessToken = parsed.searchParams.get("access_token");
          const refreshToken = parsed.searchParams.get("refresh_token");
          const expiresIn = parsed.searchParams.get("expires_in");

          if (accessToken && refreshToken && expiresIn) {
            console.log("Received tokens directly in callback");

            // Ensure refreshToken is a string or null
            setTokensElectronHandler(
              accessToken,
              refreshToken,
              Number(expiresIn),
            );

            const authBaseUrl =
              import.meta.env.VITE_AUTH_APP_URL || "http://localhost:3001";

            try {
              // Return the session to be validated by the provider
              onAuthResult(
                {
                  user: {
                    id: "user", // Will be updated after validation
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                  },
                  type: $SessionType.Enum.user,
                  isValid: true,
                },
                null,
              );
              return;
            } catch (validationError: any) {
              console.error("Token validation failed:", validationError);
              onAuthResult(
                null,
                validationError?.message || "Token validation failed",
              );
              return;
            }
          }

          // Check for error in the callback
          const errorCode = parsed.searchParams.get("error");
          if (errorCode) {
            const errorDesc = parsed.searchParams.get("error_description");
            console.error("Auth error:", errorCode, errorDesc);
            onAuthResult(
              null,
              errorDesc || `Authentication error: ${errorCode}`,
            );
            return;
          }

          // Legacy code path for compatibility
          const code = parsed.searchParams.get("code");
          if (!code) {
            onAuthResult(null, "No code or tokens in callback");
            return;
          }

          try {
            console.log("Exchanging code for tokens using OpenAuth client...");
            console.log("Exchange params:", { code, redirectUri });

            // Exchange code for tokens using the OpenAuth client directly
            const exchanged = await client.exchange(code, redirectUri);

            if (exchanged.err) {
              console.error("Exchange error:", exchanged.err);
              throw new Error(
                exchanged.err.message || "Failed to exchange code",
              );
            }

            console.log("Received tokens from exchange:", {
              access: exchanged.tokens.access ? "present" : "missing",
              refresh: exchanged.tokens.refresh ? "present" : "missing",
              expiresIn: exchanged.tokens.expiresIn,
            });

            // Store tokens in cookies
            setTokensElectronHandler(
              exchanged.tokens.access,
              exchanged.tokens.refresh,
              exchanged.tokens.expiresIn,
            );

            const newSession = {
              user: {
                id: "user",
                accessToken: exchanged.tokens.access,
                refreshToken: exchanged.tokens.refresh,
              },
              type: $SessionType.Enum.user,
              isValid: true,
            };

            console.log("Setting session after code exchange:", newSession);
            onAuthResult(newSession, null);
          } catch (exchangeError: any) {
            console.error("Code exchange failed:", exchangeError);
            onAuthResult(
              null,
              exchangeError?.message || "Failed to exchange code for tokens",
            );
          }
        } catch (e: any) {
          console.error("Auth error:", e);
          onAuthResult(null, e?.message || "Failed to authenticate");
        }
      },
    );

    // Cleanup
    return removeListener;
    // Dependency array must be empty to ensure this only runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
