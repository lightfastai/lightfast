import { DebugPanelLoader } from "~/components/debug-panel-loader";

const isDev =
  !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development";

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  const { slug, workspaceName } = await params;

  return (
    <div className="flex h-full flex-1 flex-col overflow-auto">
      <div className="flex w-full justify-center">
        <div className="w-full max-w-5xl px-6 py-2">{children}</div>
      </div>
      {isDev && <DebugPanelLoader slug={slug} workspaceName={workspaceName} />}
    </div>
  );
}
