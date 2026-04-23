import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthSnapshot } from "../../../shared/ipc";
import { AccountCard } from "./account-card";
import { SignedOutShell } from "./signed-out-shell";

export function AppShell() {
  const [auth, setAuth] = useState<AuthSnapshot>(
    () => window.lightfastBridge.auth.snapshot
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    return window.lightfastBridge.auth.onChanged(setAuth);
  }, []);

  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const err = event.query.state.error;
      if (!err) return;
      const code = (err as { data?: { code?: string } }).data?.code;
      if (code === "UNAUTHORIZED") {
        void window.lightfastBridge.auth.signOut();
      }
    });
    return unsub;
  }, [queryClient]);

  if (!auth.isSignedIn) {
    return (
      <SignedOutShell
        onSignIn={() => void window.lightfastBridge.auth.signIn()}
        onLearnMore={() =>
          void window.lightfastBridge.openExternal("https://lightfast.ai")
        }
      />
    );
  }

  return (
    <div>
      <AccountCard />
      <button
        type="button"
        onClick={() => void window.lightfastBridge.auth.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
