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

import { $SessionType, UserSession } from "@vendor/openauth";

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
  expiresIn?: number;
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
  token: string,
  refreshToken?: string,
): Promise<{
  subject?: any;
  tokens?: {
    access: string;
    refresh: string;
    expiresIn: number;
  };
}> {
  try {
    console.log("Validating token with server...");
    const response = await fetch(`${authBaseUrl}/api/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, refresh: refreshToken }),
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

    const data = await response.json();
    console.log("Token validation response:", data);

    if (!data.valid) {
      console.error("Token not valid:", data.error);
      throw new Error(data.error || "Invalid token");
    }

    return {
      subject: data.subject,
      tokens: data.tokens,
    };
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
      console.log("Auth callback result:", {
        hasSession: !!newSession,
        isValid: newSession?.isValid,
        error: newError,
        tokenInfo: newSession
          ? {
              hasAccessToken: !!newSession.user.accessToken,
              hasRefreshToken: !!newSession.user.refreshToken,
              accessTokenLength: newSession.user.accessToken
                ? newSession.user.accessToken.length
                : 0,
            }
          : null,
      });

      if (newSession?.user?.accessToken) {
        // Use auth-helper to set tokens (handles cookies and potentially other stores)
        setTokensElectronHandler(
          newSession.user.accessToken,
          newSession.user.refreshToken || "",
          newSession.expiresIn || 3600, // Default to 1 hour if not provided
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
    setLoading(true);
    setError(null);
    // Use auth-helper to clear tokens before new login attempt
    clearTokensElectronHandler();

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
      // ensure session state is also cleared
      setSession(null);
      const { url: authUrl } = await client.authorize(redirectUri, "code");
      await window.electron.shell.openExternal(authUrl);
    } catch (err: any) {
      console.error("Failed to start auth flow:", err);
      setError("Failed to start auth flow: " + (err?.message || String(err)));
      setLoading(false);
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
      const { accessToken, refreshToken } = getTokenElectronHandler();

      console.log("Tokens found via getTokenElectronHandler:", {
        hasAccessToken: !!accessToken,
      });

      if (accessToken) {
        try {
          setLoading(true);
          const verified = await validateToken(
            authBaseUrl,
            accessToken,
            refreshToken || undefined,
          );

          const validatedSession: InternalAuthSession = {
            user: {
              id:
                verified.subject?.properties?.id ||
                verified.subject?.properties?.email ||
                "user",
              accessToken: verified.tokens?.access || accessToken,
              refreshToken: verified.tokens?.refresh || refreshToken || "",
            },
            type: $SessionType.Enum.user,
            isValid: true,
            expiresIn: verified.tokens?.expiresIn,
          };

          // Update tokens using auth-helper with potentially refreshed tokens
          setTokensElectronHandler(
            validatedSession.user.accessToken,
            validatedSession.user.refreshToken,
            validatedSession.expiresIn || 3600, // Default to 1 hour
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
      } else {
        console.log("No access token found by getTokenElectronHandler");
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
