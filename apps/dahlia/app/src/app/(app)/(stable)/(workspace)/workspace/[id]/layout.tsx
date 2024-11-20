import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import { EditorWorkspaceLinks } from "../components/app/editor-workspace-links";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

/**
 * Get workspace from params, handling errors
 * @todo - handle unauthorized and not found errors more gracefully
 */
const getWorkspaceFromParams = async ({
  id,
}: WorkspaceLayoutProps["params"]) => {
  const workspace = await api.workspace.get({ id }).catch((e) => {
    if (e instanceof TRPCError && e.code === "UNAUTHORIZED") {
      return null;
    } else if (e instanceof TRPCError && e.code === "NOT_FOUND") {
      return null;
    }
    throw e;
  });
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
