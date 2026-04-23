import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/app-trpc/react";

export function AccountCard() {
  const trpc = useTRPC();
  const query = useQuery(trpc.account.get.queryOptions());

  if (query.isLoading) return <p>Loading account…</p>;
  if (query.error) return <p>Error: {query.error.message}</p>;
  if (!query.data) return null;

  const user = query.data;
  return (
    <div className="account-card">
      <h1>{user.fullName ?? "Unknown"}</h1>
      <p>{user.primaryEmailAddress ?? ""}</p>
    </div>
  );
}
