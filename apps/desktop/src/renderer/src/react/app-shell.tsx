import { useQueryClient } from "@tanstack/react-query";
import { captureException } from "@vendor/observability/sentry-browser";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { AccountCard } from "./account-card";
import { SignedOutShell } from "./signed-out-shell";
import { useAuthSnapshot } from "./use-auth-snapshot";

let signoutFailureReported = false;

export function AppShell() {
  const auth = useAuthSnapshot();
  const queryClient = useQueryClient();

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
            captureException(new Error("auto-sign-out failed"), {
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
          onLearnMore={() => void window.lightfastBridge.openApp()}
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
