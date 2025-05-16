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
      console.error(
        "[RENDERER] Auth callback registration API (window.electron.auth.onAuthCallback) not available!",
      );
      onAuthResult(
        null,
        "Electron auth API not available for callback handling.",
      );
      return;
    }

    console.log(
      "[RENDERER] Registering auth callback handler in useAuthCallback.",
    );
    const processedUrls = new Set<string>();

    const removeListener = window.electron.auth.onAuthCallback(
      async (url: string) => {
        console.log(
          "[RENDERER] 'auth-callback' event received in useAuthCallback with URL:",
          url,
        );
        if (processedUrls.has(url)) {
          console.log("[RENDERER] Already processed this URL, skipping:", url);
          return;
        }
        processedUrls.add(url);

        try {
          const parsed = new URL(url);
          const redirectUri = "lightfast://auth/callback";

          const accessToken = parsed.searchParams.get("access_token");
          const refreshToken = parsed.searchParams.get("refresh_token");
          const expiresInStr = parsed.searchParams.get("expires_in");

          if (accessToken && refreshToken && expiresInStr) {
            console.log("[RENDERER] Tokens received directly in callback.");
            const expiresIn = Number(expiresInStr);
            setTokensElectronHandler(accessToken, refreshToken, expiresIn);
            // For direct tokens, we assume they are valid for now and let AuthProvider validate later if needed
            // Or, you could add a quick validation step here if your OpenAuth client supports it client-side safely
            onAuthResult(
              {
                type: $SessionType.Enum.user,
                user: {
                  id: "user_from_direct_token",
                  accessToken,
                  refreshToken,
                }, // ID might be placeholder until full validation
                isValid: true, // Tentatively true
                expiresIn,
              },
              null,
            );
            return;
          }

          const errorCode = parsed.searchParams.get("error");
          if (errorCode) {
            const errorDesc = parsed.searchParams.get("error_description");
            console.error(
              "[RENDERER] Auth error in callback URL:",
              errorCode,
              errorDesc,
            );
            onAuthResult(
              null,
              errorDesc || `Authentication error: ${errorCode}`,
            );
            return;
          }

          const code = parsed.searchParams.get("code");
          if (!code) {
            console.error(
              "[RENDERER] No code or direct tokens in callback URL.",
            );
            onAuthResult(
              null,
              "No authorization code or tokens in callback URL.",
            );
            return;
          }

          console.log(
            "[RENDERER] Exchanging code for tokens using OpenAuth client...",
          );
          const exchanged = await client.exchange(code, redirectUri);
          if (exchanged.err) {
            console.error("[RENDERER] Code exchange failed:", exchanged.err);
            throw new Error(exchanged.err.message || "Failed to exchange code");
          }

          console.log("[RENDERER] Code exchange successful. Tokens received.");
          setTokensElectronHandler(
            exchanged.tokens.access,
            exchanged.tokens.refresh,
            exchanged.tokens.expiresIn,
          );
          onAuthResult(
            {
              type: $SessionType.Enum.user,
              user: {
                id: "user_from_code_exchange",
                accessToken: exchanged.tokens.access,
                refreshToken: exchanged.tokens.refresh,
              },
              isValid: true, // Tentatively true
              expiresIn: exchanged.tokens.expiresIn,
            },
            null,
          );
        } catch (e: any) {
          console.error(
            "[RENDERER] Critical error in auth callback processing logic:",
            e,
          );
          onAuthResult(null, e?.message || "Critical auth callback failure");
        }
      },
    );

    return () => {
      console.log(
        "[RENDERER] Cleaning up auth callback listener in useAuthCallback.",
      );
      removeListener();
    };
    // Ensure onAuthResult is stable or memoized if included, otherwise an empty array is often preferred if the setup truly doesn't change.
    // For simplicity and if onAuthResult from AuthProvider is stable (wrapped in useCallback with empty deps), this is okay.
  }, [onAuthResult]);
}
