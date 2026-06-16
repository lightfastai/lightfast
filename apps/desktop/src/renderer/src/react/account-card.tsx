import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui-v2/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "./trpc/react";
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
    return <p className="text-muted-foreground">Loading account...</p>;
  }
  if (query.error) {
    return <p className="text-destructive">Error: {query.error.message}</p>;
  }
  if (!query.data) {
    return null;
  }

  const user = query.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.fullName ?? "Unknown"}</CardTitle>
        <CardDescription>{user.primaryEmailAddress ?? ""}</CardDescription>
      </CardHeader>
    </Card>
  );
}
