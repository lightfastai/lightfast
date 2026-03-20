import { WorkspacesList } from "~/components/workspaces-list";

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Access verification handled in [slug]/layout.tsx
  // Data is already prefetched in layout - no need to duplicate here

  return (
    <div className="flex h-full flex-1 flex-col overflow-auto">
      <div className="flex flex-col gap-6 px-6 pt-2 pb-6">
        <WorkspacesList orgSlug={slug} />
      </div>
    </div>
  );
}
