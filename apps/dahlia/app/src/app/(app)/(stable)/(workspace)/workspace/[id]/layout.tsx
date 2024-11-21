import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { RouterInputs, RouterOutputs } from "@repo/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";

import { api } from "~/trpc/server";
import { EditorWorkspaceNameInput } from "../components/app/editor-workspace-name-input";
import { EditorWorkspaceSelect } from "../components/app/editor-workspace-select";

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
const getWorkspaceById = async ({
  id,
}: RouterInputs["workspace"]["get"]): Promise<
  RouterOutputs["workspace"]["get"] | null
> => {
  try {
    const workspace = await api.workspace.get({ id });
    return workspace;
  } catch (e) {
    if (e instanceof TRPCError) {
      switch (e.code) {
        case "UNAUTHORIZED":
          // Handle unauthorized access
          console.error("Unauthorized access to workspace:", id);
          break;
        case "NOT_FOUND":
          // Handle workspace not found
          console.warn("Workspace not found:", id);
          break;
        default:
          // Handle other TRPC errors
          console.error("An unexpected TRPC error occurred:", e.message);
      }
    } else {
      // Handle non-TRPC errors
      console.error("An unexpected error occurred:", e);
    }
    return null;
  }
};

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = params;
  const workspace = await getWorkspaceById({ id });
  if (!workspace) {
    notFound();
  }

  return (
    <div className="relative flex h-screen flex-col">
      <div className="fixed inset-x-20 top-4 z-50 flex w-max items-center">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <EditorWorkspaceSelect />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <EditorWorkspaceNameInput initialWorkspace={workspace} />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {children}
    </div>
  );
}
