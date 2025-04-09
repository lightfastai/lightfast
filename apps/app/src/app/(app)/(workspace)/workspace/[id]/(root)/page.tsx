import type { RouterInputs } from "~/trpc/server/index";
import { Workspace } from "../../components/workspace/workspace";

interface WorkspacePageProps {
  params: Promise<{
    id: RouterInputs["tenant"]["workspace"]["get"]["id"];
  }>;
}

export default async function WorkspacePage(props: WorkspacePageProps) {
  const params = await props.params;
  const { id } = params;
  return <Workspace params={{ id }} />;
}
