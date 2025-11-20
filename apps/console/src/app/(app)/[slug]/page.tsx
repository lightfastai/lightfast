import { WorkspacesList } from "~/components/workspaces-list";

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Data is already prefetched in layout - no need to duplicate here

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <div className="flex flex-col gap-6 pt-2 px-6 pb-6">
        <WorkspacesList orgSlug={slug} />
      </div>
    </div>
  );
}
