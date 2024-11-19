import { WorkspaceBreadcrumbLinks } from "./components/workspace-breadcrumb-links";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

export default function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = params;
  return (
    <div className="fixed inset-0 flex flex-col">
      <WorkspaceBreadcrumbLinks id={id} />
      {children}
    </div>
  );
}
