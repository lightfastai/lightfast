import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { $SessionType, UserSession } from "@vendor/openauth";

import {
  clearTokensElectronHandler,
  getTokenElectronHandler,
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

      setSession(newSession);
      setError(newError);
      setLoading(false);

      // No navigation here - will be handled by the route component
    },
    [],
  );

  // Register the callback handler
  useAuthCallback(handleAuthResult);

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
      clearTokensElectronHandler();

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

  // Logout function
  const logout = useCallback(() => {
    console.log("Logging out - clearing tokens and session");
    clearTokensElectronHandler();
    setSession(null);
    // Navigation is handled by the route component
  }, []);

  // On mount, restore and validate session from cookies
  useEffect(() => {
    const restoreSession = async () => {
      console.log("Attempting to restore session from cookies");
      const { accessToken, refreshToken } = getTokenElectronHandler();

      if (accessToken) {
        console.log("Found access token in cookies, validating...");
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
          };

          console.log("Session restored successfully:", validatedSession);
          setSession(validatedSession);
        } catch (error) {
          console.error("Session restoration failed:", error);
          // Clear invalid tokens
          clearTokensElectronHandler();
          setSession(null);
        } finally {
          setLoading(false);
        }
      } else {
        console.log("No access token found in cookies");
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
