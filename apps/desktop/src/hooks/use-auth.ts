import { useCallback, useEffect, useState } from "react";

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

interface AuthSession {
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  isValid?: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authBaseUrl =
    import.meta.env.VITE_AUTH_APP_URL || "http://localhost:3001";
  const redirectUri =
    import.meta.env.VITE_AUTH_APP_REDIRECT_URI || "lightfast://auth/callback";

  // Construct login URL with redirect_uri for the auth page
  const loginUrl = `${authBaseUrl}/auth?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const login = useCallback(() => {
    setLoading(true);
    setError(null);

    // Debug logging
    console.log("Auth URL:", authBaseUrl);
    console.log("Redirect URI:", redirectUri);
    console.log("Full login URL:", loginUrl);

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

    // Clear any existing tokens before starting a new login
    localStorage.removeItem("auth_access_token");
    localStorage.removeItem("auth_refresh_token");

    window.electron.shell
      .openExternal(loginUrl)
      .then(() => console.log("Browser open request sent"))
      .catch((err) => {
        console.error("Failed to open browser:", err);
        setError("Failed to open browser: " + (err?.message || String(err)));
        setLoading(false);
      });
  }, [loginUrl, authBaseUrl, redirectUri]);

  // Validate token with the auth server
  const validateToken = useCallback(
    async (token: string, refreshToken?: string): Promise<AuthSession> => {
      try {
        const response = await fetch(`${authBaseUrl}/api/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, refresh: refreshToken }),
        });

        if (!response.ok) {
          throw new Error("Token validation failed");
        }

        const data = await response.json();

        if (!data.valid) {
          throw new Error(data.error || "Invalid token");
        }

        // Update tokens if refreshed
        const updatedSession: AuthSession = {
          accessToken: token,
          refreshToken,
          userId: data.subject?.properties?.id,
          isValid: true,
        };

        if (data.tokens) {
          updatedSession.accessToken = data.tokens.access;
          updatedSession.refreshToken = data.tokens.refresh;

          // Update localStorage with new tokens
          localStorage.setItem("auth_access_token", data.tokens.access);
          localStorage.setItem("auth_refresh_token", data.tokens.refresh);
        }

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
    localStorage.removeItem("auth_access_token");
    localStorage.removeItem("auth_refresh_token");
    setSession(null);
  }, []);

  // Listen for auth callback from main process
  useEffect(() => {
    if (!window.electron?.auth?.onAuthCallback) {
      console.error("Auth callback registration not available");
      return;
    }

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
            setSession(validatedSession);
            setLoading(false);
            return;
          }

          // Legacy code path for compatibility
          const code = parsed.searchParams.get("code");
          if (!code) throw new Error("No code or tokens in callback");

          // Exchange code for tokens
          const callbackUrl = `${authBaseUrl}/api/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
          console.log("Exchanging code at:", callbackUrl);

          const res = await fetch(callbackUrl, { credentials: "include" });
          if (!res.ok) throw new Error("Failed to exchange code for tokens");
          const data = await res.json();

          console.log("Received tokens:", data);

          // Store tokens in localStorage
          localStorage.setItem("auth_access_token", data.access);
          localStorage.setItem("auth_refresh_token", data.refresh);

          setSession({
            accessToken: data.access,
            refreshToken: data.refresh,
            isValid: true,
          });
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
      const accessToken = localStorage.getItem("auth_access_token");
      const refreshToken = localStorage.getItem("auth_refresh_token");

      if (accessToken) {
        try {
          setLoading(true);
          const validatedSession = await validateToken(
            accessToken,
            refreshToken || undefined,
          );
          setSession(validatedSession);
        } catch (error) {
          console.error("Session restoration failed:", error);
          // Clear invalid tokens
          localStorage.removeItem("auth_access_token");
          localStorage.removeItem("auth_refresh_token");
        } finally {
          setLoading(false);
        }
      }
    };

    restoreSession();
  }, [validateToken]);

  return {
    session,
    login,
    logout,
    loading,
    error,
    isAuthenticated: !!session?.isValid,
  };
}
