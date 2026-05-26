import { useTRPC } from "@repo/app-trpc/react";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useAuthSnapshot } from "../../use-auth-snapshot";

export function Account() {
  const auth = useAuthSnapshot();
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.viewer.account.get.queryOptions(),
    enabled: auth.isSignedIn,
  });
  const data = query.data;

  if (!auth.isSignedIn) {
    return (
      <section className="settings-section">
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row__label">Not signed in</div>
            <button
              className="settings-button"
              onClick={() => void window.lightfastBridge.auth.signIn()}
              type="button"
            >
              Sign in
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <div className="settings-card">
        <div className="settings-row">
          <div className="account-identity">
            <div
              aria-hidden
              className={
                data?.imageUrl
                  ? "account-avatar"
                  : "account-avatar account-avatar--placeholder"
              }
              style={
                data?.imageUrl
                  ? { backgroundImage: `url("${data.imageUrl}")` }
                  : undefined
              }
            />
            <div>
              <div className="account-name">{data?.fullName ?? "—"}</div>
              <div className="account-email">
                {data?.primaryEmailAddress ?? ""}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row__label">Sign out of Lightfast</div>
          <button
            className="settings-button settings-button--destructive"
            onClick={() => void window.lightfastBridge.auth.signOut()}
            type="button"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </section>
  );
}
