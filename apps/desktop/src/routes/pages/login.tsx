import { useAuth } from "@/hooks/use-auth";

import { Button } from "@repo/ui/components/ui/button";

export default function LoginPage() {
  const { login, loading, error } = useAuth();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Sign in to Lightfast</h1>
      <Button onClick={login} disabled={loading}>
        {loading ? "Opening browser..." : "Sign in with Email"}
      </Button>
      {error && <div className="mt-2 text-sm text-red-500">{error}</div>}
    </div>
  );
}
