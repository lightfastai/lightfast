import type { RouterInputs } from "~/trpc/server/index";
import { Workspace } from "../../components/workspace/workspace";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["tenant"]["workspace"]["get"]["id"];
  };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  return <Workspace params={{ id }} />;
}
