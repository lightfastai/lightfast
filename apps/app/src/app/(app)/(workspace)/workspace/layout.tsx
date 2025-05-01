import { notFound } from "next/navigation";

import { getQueryClient, trpc } from "@vendor/trpc/client/server";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  const session = await queryClient.fetchQuery(
    trpc.app.auth.getSession.queryOptions(),
  );

  if (!session?.user.clerkId) {
    notFound();
  }

  return <>{children}</>;
}
