import { EditorHeader } from "./components/app/editor-header";

export default function NetworkEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full border">
      <EditorHeader />
      {children}
    </div>
  );
}
