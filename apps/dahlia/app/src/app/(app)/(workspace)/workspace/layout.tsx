import { notFound } from "next/navigation";

import { SentryIdentifier } from "~/hooks/use-sentry-identifier";
import { api } from "~/trpc/server";
import { EditorHeaderMenu } from "./components/app/editor-header-file";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await api.auth.getSession();

  if (!session) {
    notFound();
  }

  return (
    <>
      <EditorHeaderMenu />
      <SentryIdentifier userId={session.user.id} />
      {children}
    </>
  );
}
