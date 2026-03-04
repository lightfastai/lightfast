import { DebugPanelLoader } from "~/components/debug-panel-loader";

const isDev = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development";

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  const { slug, workspaceName } = await params;

  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <div className="flex justify-center w-full">
        <div className="w-full max-w-5xl px-6 py-2">{children}</div>
      </div>
      {isDev && <DebugPanelLoader slug={slug} workspaceName={workspaceName} />}
    </div>
  );
}
