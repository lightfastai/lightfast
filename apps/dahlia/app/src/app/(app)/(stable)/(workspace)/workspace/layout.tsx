import { EditorHeaderMenu } from "./components/app/editor-header-file";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <EditorHeaderMenu />
      {children}
    </>
  );
}
