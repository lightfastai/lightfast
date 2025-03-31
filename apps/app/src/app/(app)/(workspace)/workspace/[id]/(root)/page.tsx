import type { RouterInputs } from "~/trpc/server/index";
import { Workspace } from "../../components/workspace/workspace";
import { WorkspaceReactFlowProvider } from "../../providers/workspace-react-flow-provider";
import { WorkspaceViewProvider } from "../../providers/workspace-view-provider";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["tenant"]["workspace"]["get"]["id"];
  };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  return (
    <WorkspaceViewProvider>
      <WorkspaceReactFlowProvider>
        <Workspace params={{ id }} />
      </WorkspaceReactFlowProvider>
    </WorkspaceViewProvider>
  );
}
