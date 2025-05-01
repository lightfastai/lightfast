import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { getQueryClient, trpc } from "@vendor/trpc/client/server";

import { FetchSecretTest } from "~/components/fetch-secret-test";

export default async function Page() {
  const queryClient = getQueryClient();
  const data = await queryClient.fetchQuery(
    trpc.app.auth.randomSecret.queryOptions(),
  );
  console.log("server data", data);
  return (
    <main className="relative flex-1 overflow-hidden">
      <pre>{data}</pre>
      {/* <Workspace debug /> */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Open</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
          <DropdownMenuItem>Item 3</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FetchSecretTest />
    </main>
  );
}
