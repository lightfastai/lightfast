import { RouterInputs } from "@repo/api";

import { Workspace } from "../components/workspace/workspace";
import { WorkspaceProvider } from "../components/workspace/workspace-provider";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["workspace"]["get"]["id"];
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  return (
    <>
      <WorkspaceProvider>
        <Workspace params={{ id }} />
      </WorkspaceProvider>
    </>
  );
}
