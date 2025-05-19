import { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";

export default function LoginPage() {
  const { login, logout, loading, error, isAuthenticated } = useAuth();
  const router = useRouter();

  // Debug auth state in login page
  useEffect(() => {
    console.log("Login page auth state:", {
      isAuthenticated,
      loading,
      error,
      currentPath: router.state.location.pathname,
    });

    // If authenticated, redirect to main page
    if (isAuthenticated && !loading) {
      console.log(
        "Already authenticated in login page - redirecting to main app",
      );
      setTimeout(() => {
        router.navigate({ to: "/" });
      }, 0);
    }
  }, [isAuthenticated, loading, error, router]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Sign in to Lightfast</h1>
      <Button onClick={login} disabled={loading}>
        {loading ? "Opening browser..." : "Sign in with Email"}
      </Button>

      {error && (
        <div className="mt-2 max-w-md rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Small logout button shown when isAuthenticated but we're on the login page - 
          this can happen if the token is expired or invalid */}
      {isAuthenticated && (
        <div className="mt-4 flex flex-col items-center">
          <div className="text-muted-foreground mb-1 text-xs">
            Already have a session?
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="flex items-center gap-1 text-xs"
          >
            <LogOut className="size-3" /> Clear Session
          </Button>
        </div>
      )}
    </div>
  );
}
