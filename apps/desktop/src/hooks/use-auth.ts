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
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Construct the login URL from Vite env variables
  const loginUrl = `${import.meta.env.VITE_AUTH_APP_URL}/auth?redirect_uri=${encodeURIComponent(import.meta.env.VITE_AUTH_APP_REDIRECT_URI)}`;

  // Open the system browser for login
  const login = useCallback(() => {
    setLoading(true);
    setError(null);

    // Debug logging
    console.log("Auth URL:", import.meta.env.VITE_AUTH_APP_URL);
    console.log("Redirect URI:", import.meta.env.VITE_AUTH_APP_REDIRECT_URI);
    console.log("Full login URL:", loginUrl);

    if (!import.meta.env.VITE_AUTH_APP_URL) {
      setError("Missing VITE_AUTH_APP_URL environment variable");
      setLoading(false);
      return;
    }

    if (!window.electron?.shell?.openExternal) {
      setError("Electron shell API not available");
      setLoading(false);
      return;
    }

    window.electron.shell
      .openExternal(loginUrl)
      .then(() => console.log("Browser open request sent"))
      .catch((err) => {
        console.error("Failed to open browser:", err);
        setError("Failed to open browser: " + (err?.message || String(err)));
        setLoading(false);
      });
  }, [loginUrl]);

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
          const code = parsed.searchParams.get("code");
          if (!code) throw new Error("No code in callback");

          // Exchange code for tokens
          const callbackUrl = `${import.meta.env.VITE_AUTH_APP_URL}/api/callback?code=${encodeURIComponent(code)}`;
          console.log("Exchanging code at:", callbackUrl);

          const res = await fetch(callbackUrl, { credentials: "include" });
          if (!res.ok) throw new Error("Failed to exchange code for tokens");
          const data = await res.json();

          console.log("Received tokens:", data);

          // Store tokens in localStorage
          localStorage.setItem("auth_access_token", data.access);
          localStorage.setItem("auth_refresh_token", data.refresh);

          setSession({ accessToken: data.access, refreshToken: data.refresh });
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
  }, []);

  // On mount, restore session from localStorage
  useEffect(() => {
    const accessToken = localStorage.getItem("auth_access_token");
    const refreshToken = localStorage.getItem("auth_refresh_token");
    if (accessToken) {
      setSession({ accessToken, refreshToken: refreshToken || undefined });
    }
  }, []);

  return { session, login, loading, error };
}
