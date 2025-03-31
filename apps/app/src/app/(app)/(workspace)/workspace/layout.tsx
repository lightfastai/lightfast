import { notFound } from "next/navigation";

import { api } from "~/trpc/client/server";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await api.app.auth.getSession();

  if (!session?.user.clerkId) {
    notFound();
  }

  return <>{children}</>;
}
