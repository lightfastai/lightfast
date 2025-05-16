import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";

export default function LoginPage() {
  const { login, logout, loading, error, isAuthenticated } = useAuth();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Sign in to Lightfast</h1>
      <Button onClick={login} disabled={loading}>
        {loading ? "Opening browser..." : "Sign in with Email"}
      </Button>
      {error && <div className="mt-2 text-sm text-red-500">{error}</div>}

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
