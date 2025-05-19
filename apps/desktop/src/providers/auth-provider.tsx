import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Cookies will be managed by auth-helpers, so direct import might not be needed here
// import Cookies from "js-cookie";

import { TokenOrNull, UserSession } from "@vendor/openauth";

import {
  clearTokensElectronHandler,
  getTokenElectronHandler,
  setTokensElectronHandler,
  // Cookie name constants are used internally by auth-helpers, no need to import them here
  // ACCESS_TOKEN_COOKIE_NAME,
  // REFRESH_TOKEN_COOKIE_NAME,
} from "../helpers/auth-helpers";
import { client, useAuthCallback } from "../hooks/use-auth";

interface InternalAuthSession extends UserSession {
  isValid?: boolean;
}

interface AuthContextType {
  session: InternalAuthSession | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface LightfastElectronAuthProviderProps {
  children: ReactNode;
}

// Helper function to validate tokens
async function validateToken(
  authBaseUrl: string,
  token: TokenOrNull,
): Promise<UserSession> {
  try {
    console.log("Validating token with server...");
    const response = await fetch(`${authBaseUrl}/api/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(token),
      credentials: "omit",
      mode: "cors",
    });

    if (!response.ok) {
      console.error(
        "Token validation failed: Server returned",
        response.status,
      );
      throw new Error("Token validation failed");
    }

    const data = (await response.json()) as UserSession;
    console.log("Token validation response:", data);

    if (!data.user.accessToken) {
      throw new Error("Invalid token");
    }

    return data;
  } catch (error) {
    console.error("Token validation error:", error);
    throw error;
  }
}

export function LightfastElectronAuthProvider({
  children,
}: LightfastElectronAuthProviderProps) {
  const [session, setSession] = useState<InternalAuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authBaseUrl =
    import.meta.env.VITE_AUTH_APP_URL || "http://localhost:3001";
  const redirectUri = "lightfast://auth/callback";

  // Handle auth callback result
  const handleAuthResult = useCallback(
    (newSession: InternalAuthSession | null, newError: string | null) => {
      if (newSession?.user?.accessToken) {
        // Use auth-helper to set tokens (handles cookies and potentially other stores)
        setTokensElectronHandler(
          newSession.user.accessToken,
          newSession.user.refreshToken || "",
          newSession.user.expiresIn || 3600, // Default to 1 hour if not provided
        );
      } else {
        // Use auth-helper to clear tokens
        clearTokensElectronHandler();
      }

      if (newSession?.user?.accessToken) {
        // Use auth-helper to set tokens (handles cookies and potentially other stores)
        setTokensElectronHandler(
          newSession.user.accessToken,
          newSession.user.refreshToken || "",
          newSession.user.expiresIn || 3600, // Default to 1 hour if not provided
        );
      } else {
        // Use auth-helper to clear tokens
        clearTokensElectronHandler();
      }

      setSession(newSession);
      setError(newError);
      setLoading(false);
    },
    [],
  );

  // Register the callback handler
  useAuthCallback(handleAuthResult);

  const login = useCallback(async () => {
    console.log("[AUTH PROVIDER] Login attempt started.");
    setLoading(true);
    setError(null);
    clearTokensElectronHandler();

    if (!authBaseUrl) {
      console.error("[AUTH PROVIDER] Missing VITE_AUTH_APP_URL.");
      setError("Missing VITE_AUTH_APP_URL environment variable");
      setLoading(false);
      return;
    }

    if (!window.electron?.shell?.openExternal) {
      console.error("[AUTH PROVIDER] Electron shell API not available.");
      setError("Electron shell API not available");
      setLoading(false);
      return;
    }

    try {
      setSession(null); // Clear current session state immediately
      const { url: authUrl } = await client.authorize(redirectUri, "code");
      console.log("[AUTH PROVIDER] Authorization URL generated:", authUrl);
      await window.electron.shell.openExternal(authUrl);
      console.log(
        "[AUTH PROVIDER] Browser open request sent. Waiting for callback...",
      );
      // setLoading(false) is NOT called here; it's handled by handleAuthResult
    } catch (err: any) {
      console.error("[AUTH PROVIDER] Failed to start auth flow:", err);
      setError("Failed to start auth flow: " + (err?.message || String(err)));
      setLoading(false); // Ensure loading is false if error occurs here
    }
  }, [authBaseUrl, redirectUri]);

  const logout = useCallback(() => {
    console.log("Logging out - clearing tokens and session");
    // Use auth-helper to clear tokens
    clearTokensElectronHandler();
    setSession(null);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      console.log("Attempting to restore session using auth-helpers");
      // getTokenElectronHandler already checks cookies via auth-helpers
      const tokens = getTokenElectronHandler();

      console.log("Tokens found via getTokenElectronHandler:", {
        hasAccessToken: !!tokens?.accessToken,
      });

      if (!tokens?.accessToken) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const verified = await validateToken(authBaseUrl, tokens);

        const validatedSession: InternalAuthSession = {
          ...verified,
          isValid: true,
        };

        // Update tokens using auth-helper with potentially refreshed tokens
        setTokensElectronHandler(
          validatedSession.user.accessToken,
          validatedSession.user.refreshToken,
          validatedSession.user.expiresIn,
        );

        setSession(validatedSession);
      } catch (error) {
        console.error("Session restoration failed:", error);
        // Use auth-helper to clear tokens on failure
        clearTokensElectronHandler();
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, [authBaseUrl]);

  const value = {
    session,
    loading,
    error,
    isAuthenticated: !!session?.isValid,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within a LightfastElectronAuthProvider",
    );
  }

  return context;
}
