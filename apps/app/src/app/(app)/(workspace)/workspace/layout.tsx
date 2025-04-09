import { notFound } from "next/navigation";

import { api, getQueryClient } from "~/trpc/client/server";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  const session = await queryClient.fetchQuery(
    api.app.auth.getSession.queryOptions(),
  );
  if (!session?.user.clerkId) {
    return notFound();
  }

  // @todo add checker that user owns the workspace....

  return <>{children}</>;
}
