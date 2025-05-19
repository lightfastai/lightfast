import { useCallback, useEffect, useState } from "react";
import { createClient } from "@openauthjs/openauth/client";
import { useRouter } from "@tanstack/react-router";

import { $SessionType, UserSession } from "@vendor/openauth";

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

interface InternalAuthSession extends UserSession {
  isValid?: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<InternalAuthSession | null>(null);
  const [loading, setLoading] = useState(true); // Start as loading to prevent flash of unauthenticated state
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const authBaseUrl =
    import.meta.env.VITE_AUTH_APP_URL || "http://localhost:3001";
  const redirectUri = "lightfast://auth/callback";

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Debug logging
    console.log("Auth URL:", authBaseUrl);
    console.log("Redirect URI:", redirectUri);

    if (!authBaseUrl) {
      setError("Missing VITE_AUTH_APP_URL environment variable");
      setLoading(false);
      return;
    }

    if (!window.electron?.shell?.openExternal) {
      setError("Electron shell API not available");
      setLoading(false);
      return;
    }

    try {
      // Clear any existing tokens before starting a new login
      localStorage.removeItem("auth_access_token");
      localStorage.removeItem("auth_refresh_token");

      // Also clear session state
      setSession(null);

      // Generate authorization URL directly using OpenAuth client
      const { url: authUrl } = await client.authorize(redirectUri, "code");
      console.log("Full auth URL:", authUrl);

      // Open the auth URL in the user's browser
      await window.electron.shell.openExternal(authUrl);
      console.log("Browser open request sent");
    } catch (err: any) {
      console.error("Failed to start auth flow:", err);
      setError("Failed to start auth flow: " + (err?.message || String(err)));
      setLoading(false);
    }
  }, [authBaseUrl, redirectUri]);

  // Validate token with the auth server
  const validateToken = useCallback(
    async (
      token: string,
      refreshToken?: string,
    ): Promise<InternalAuthSession> => {
      try {
        console.log("Validating token with server...");
        const response = await fetch(`${authBaseUrl}/api/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, refresh: refreshToken }),
        });

        if (!response.ok) {
          console.error(
            "Token validation failed: Server returned",
            response.status,
          );
          throw new Error("Token validation failed");
        }

        const data = await response.json();
        console.log("Token validation response:", data);

        if (!data.valid) {
          console.error("Token not valid:", data.error);
          throw new Error(data.error || "Invalid token");
        }

        console.log("Data subject:", data.subject);

        // Update tokens if refreshed
        const updatedSession: InternalAuthSession = {
          user: {
            id: data.subject?.properties?.id || data.subject?.properties?.email,
            accessToken: token,
            refreshToken: refreshToken || "",
          },
          type: $SessionType.Enum.user,
          isValid: true,
        };

        if (data.tokens) {
          console.log("Received refreshed tokens");
          updatedSession.user.accessToken = data.tokens.access;
          updatedSession.user.refreshToken = data.tokens.refresh;

          // Update localStorage with new tokens
          localStorage.setItem("auth_access_token", data.tokens.access);
          localStorage.setItem("auth_refresh_token", data.tokens.refresh);
        }

        console.log("Session is valid:", updatedSession);
        return updatedSession;
      } catch (error) {
        console.error("Token validation error:", error);
        throw error;
      }
    },
    [authBaseUrl],
  );

  // Logout function
  const logout = useCallback(() => {
    console.log("Logging out - clearing tokens and session");
    localStorage.removeItem("auth_access_token");
    localStorage.removeItem("auth_refresh_token");
    setSession(null);
    router.navigate({ to: "/login" });
  }, [router]);

  // Listen for auth callback from main process
  useEffect(() => {
    if (!window.electron?.auth?.onAuthCallback) {
      console.error("Auth callback registration not available");
      return;
    }

    console.log("Registering auth callback handler");
    // Register auth callback handler
    const removeListener = window.electron.auth.onAuthCallback(
      async (url: string) => {
        try {
          console.log("Received auth callback:", url);
          const parsed = new URL(url);

          // Handle redirect with tokens in URL (new flow)
          const accessToken = parsed.searchParams.get("access_token");
          const refreshToken = parsed.searchParams.get("refresh_token");

          if (accessToken) {
            console.log("Received tokens directly in callback");

            // Store tokens in localStorage
            localStorage.setItem("auth_access_token", accessToken);
            if (refreshToken) {
              localStorage.setItem("auth_refresh_token", refreshToken);
            }

            // Validate token to get user info
            const validatedSession = await validateToken(
              accessToken,
              refreshToken || undefined,
            );
            console.log("Setting session after validation:", validatedSession);
            setSession(validatedSession);
            setLoading(false);
            router.navigate({ to: "/" });
            return;
          }

          // Check for error in the callback
          const errorCode = parsed.searchParams.get("error");
          if (errorCode) {
            const errorDesc = parsed.searchParams.get("error_description");
            console.error("Auth error:", errorCode, errorDesc);
            throw new Error(errorDesc || `Authentication error: ${errorCode}`);
          }

          // Legacy code path for compatibility
          const code = parsed.searchParams.get("code");
          if (!code) throw new Error("No code or tokens in callback");

          try {
            console.log("Exchanging code for tokens using OpenAuth client...");
            // Exchange code for tokens using the OpenAuth client directly
            const exchanged = await client.exchange(code, redirectUri);
            if (exchanged.err) {
              throw new Error(
                exchanged.err.message || "Failed to exchange code",
              );
            }

            console.log("Received tokens from exchange:", exchanged.tokens);

            // Store tokens in localStorage
            localStorage.setItem("auth_access_token", exchanged.tokens.access);
            localStorage.setItem(
              "auth_refresh_token",
              exchanged.tokens.refresh,
            );

            const newSession: InternalAuthSession = {
              user: {
                id: "user",
                accessToken: exchanged.tokens.access,
                refreshToken: exchanged.tokens.refresh,
              },
              type: $SessionType.Enum.user,
              isValid: true,
            };

            console.log("Setting session after code exchange:", newSession);
            setSession(newSession);
            router.navigate({ to: "/" });
          } catch (exchangeError) {
            console.error("Code exchange failed:", exchangeError);

            // Fallback to server-side exchange if direct exchange fails
            console.log("Falling back to server-side exchange");
            const callbackUrl = `${authBaseUrl}/api/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
            console.log("Exchanging code at:", callbackUrl);

            const res = await fetch(callbackUrl, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to exchange code for tokens");
            const data = await res.json();

            console.log("Received tokens from server exchange:", data);

            // Store tokens in localStorage
            localStorage.setItem("auth_access_token", data.access);
            localStorage.setItem("auth_refresh_token", data.refresh);

            const newSession: InternalAuthSession = {
              user: {
                id: "user",
                accessToken: data.access,
                refreshToken: data.refresh,
              },
              type: $SessionType.Enum.user,
              isValid: true,
            };

            console.log("Setting session after server exchange:", newSession);
            setSession(newSession);
          }

          setLoading(false);
        } catch (e: any) {
          console.error("Auth error:", e);
          setError(e?.message || "Failed to authenticate");
          setLoading(false);
        }
      },
    );

    // Cleanup
    return removeListener;
  }, [authBaseUrl, redirectUri, validateToken]);

  // On mount, restore and validate session from localStorage
  useEffect(() => {
    const restoreSession = async () => {
      console.log("Attempting to restore session from localStorage");
      const accessToken = localStorage.getItem("auth_access_token");
      const refreshToken = localStorage.getItem("auth_refresh_token");

      if (accessToken) {
        console.log("Found access token in localStorage, validating...");
        try {
          setLoading(true);
          const validatedSession = await validateToken(
            accessToken,
            refreshToken || undefined,
          );
          console.log("Session restored successfully:", validatedSession);
          setSession(validatedSession);
        } catch (error) {
          console.error("Session restoration failed:", error);
          // Clear invalid tokens
          localStorage.removeItem("auth_access_token");
          localStorage.removeItem("auth_refresh_token");
          setSession(null);
        } finally {
          setLoading(false);
        }
      } else {
        console.log("No access token found in localStorage");
        setLoading(false);
      }
    };

    restoreSession();
  }, [validateToken]);

  // Log whenever authentication state changes
  useEffect(() => {
    console.log("Authentication state updated:", {
      isAuthenticated: !!session?.isValid,
      loading,
      error,
    });
  }, [session, loading, error]);

  return {
    session,
    login,
    logout,
    loading,
    error,
    isAuthenticated: !!session?.isValid,
  };
}
