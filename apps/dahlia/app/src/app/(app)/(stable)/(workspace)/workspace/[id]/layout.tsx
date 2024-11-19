import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { WorkspaceBreadcrumbLinks } from "./components/workspace-breadcrumb-links";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = params;
  // check if the workspace exists
  const workspace = await api.workspace.get({ id }).catch(() => null);
  if (!workspace) {
    notFound();
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      <WorkspaceBreadcrumbLinks id={id} />
      {children}
    </div>
  );
}
