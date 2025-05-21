import {
  getQueryClient,
  trpc,
} from "@repo/trpc-client/trpc-react-server-provider";
import { Button } from "@repo/ui/components/ui/button";
import { login } from "@vendor/openauth/server";

import { FetchSecretTest } from "~/components/fetch-secret-test";

export default async function AppPage() {
  const queryClient = getQueryClient();
  const session = await queryClient.fetchQuery(
    trpc.app.auth.getSession.queryOptions(),
  );

  return (
    <div>
      App {session?.user.id}
      <Button onClick={login}>Login</Button>
      <FetchSecretTest />
    </div>
  );
}
