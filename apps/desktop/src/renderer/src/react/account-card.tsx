import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui-v2/components/ui/card";
import { useAuthSnapshot } from "./use-auth-snapshot";

export function AccountCard() {
  const auth = useAuthSnapshot();

  if (!auth.isSignedIn) {
    return null;
  }

  const primaryIdentity = auth.userUsername ?? auth.userEmail ?? "Unknown";
  const secondaryIdentity =
    auth.userUsername && auth.userEmail ? auth.userEmail : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{primaryIdentity}</CardTitle>
        <CardDescription>{secondaryIdentity}</CardDescription>
      </CardHeader>
    </Card>
  );
}
