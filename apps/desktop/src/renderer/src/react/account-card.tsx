import { useTRPC } from "@repo/app-trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useAuthSnapshot } from "./use-auth-snapshot";

export function AccountCard() {
  const auth = useAuthSnapshot();
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.viewer.account.get.queryOptions(),
    enabled: auth.isSignedIn,
  });

  if (!auth.isSignedIn) {
    return null;
  }
  if (query.isLoading) {
    return <p>Loading account…</p>;
  }
  if (query.error) {
    return <p>Error: {query.error.message}</p>;
  }
  if (!query.data) {
    return null;
  }

  const user = query.data;
  return (
    <div className="account-card">
      <h1>{user.fullName ?? "Unknown"}</h1>
      <p>{user.primaryEmailAddress ?? ""}</p>
    </div>
  );
}
