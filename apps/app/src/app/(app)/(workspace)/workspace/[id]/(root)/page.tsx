import type { RouterInputs } from "~/trpc/server/index";
import { Workspace } from "../../components/workspace/workspace";
import { WorkspaceProvider } from "../../providers/workspace-provider";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["tenant"]["workspace"]["get"]["id"];
  };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  return null;
  return (
    <>
      <WorkspaceProvider>
        <Workspace params={{ id }} />
      </WorkspaceProvider>
    </>
  );
}
