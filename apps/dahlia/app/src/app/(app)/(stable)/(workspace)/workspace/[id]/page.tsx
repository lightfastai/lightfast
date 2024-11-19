interface WorkspacePageProps {
  params: {
    id: string;
  };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  return <div>Workspace {id}</div>;
}
