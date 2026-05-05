import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { AuthSnapshot } from "../../../shared/ipc";
import { SignedOutShell } from "./signed-out-shell";

export function AppShell() {
  const [auth, setAuth] = useState<AuthSnapshot>(
    () => window.lightfastBridge.auth.snapshot
  );
  const queryClient = useQueryClient();

  useEffect(() => window.lightfastBridge.auth.onChanged(setAuth), []);

  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") {
        return;
      }
      const err = event.query.state.error;
      if (!err) {
        return;
      }
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
        onLearnMore={() => void window.lightfastBridge.openApp()}
        onSignIn={() => void window.lightfastBridge.auth.signIn()}
      />
    );
  }

  return null;
}
