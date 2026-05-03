import * as Sentry from "@sentry/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import type { AuthSnapshot } from "../../../shared/ipc";
import { AccountCard } from "./account-card";
import { SignedOutShell } from "./signed-out-shell";

let signoutFailureReported = false;

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
        void window.lightfastBridge.auth.signOut().then((ok) => {
          if (!(ok || signoutFailureReported)) {
            signoutFailureReported = true;
            Sentry.captureException(new Error("auto-sign-out failed"), {
              tags: { scope: "app-shell.auto-sign-out" },
            });
          }
        });
      }
    });
    return unsub;
  }, [queryClient]);

  if (!auth.isSignedIn) {
    return (
      <>
        <Toaster />
        <SignedOutShell
          onLearnMore={() =>
            void window.lightfastBridge.openExternal("https://lightfast.ai")
          }
          onSignIn={() => {
            void window.lightfastBridge.auth.signIn().then((token) => {
              if (token) {
                signoutFailureReported = false;
                return;
              }
              toast.error("Sign-in didn't complete — please try again");
            });
          }}
        />
      </>
    );
  }

  return (
    <div>
      <Toaster />
      <AccountCard />
      <button
        onClick={() => {
          void window.lightfastBridge.auth.signOut().then((ok) => {
            if (!ok) {
              toast.error("Sign out failed — please try again");
            }
          });
        }}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}
