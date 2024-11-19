import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditorWorkspaceLinks } from "../components/app/editor-workspace-links";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

const getWorkspaceFromParams = async ({
  id,
}: WorkspaceLayoutProps["params"]) => {
  const workspace = await api.workspace.get({ id }).catch(() => null);
  if (!workspace) {
    return null;
  }
  return workspace;
};

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = params;
  const workspace = await getWorkspaceFromParams({ id });
  if (!workspace) {
    notFound();
  }

  return (
    <div className="relative flex h-screen flex-col">
      <EditorWorkspaceLinks id={id} />
      {children}
    </div>
  );
}
