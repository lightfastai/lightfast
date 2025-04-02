import { EditorFileMenu } from "../components/app/editor-file-menu";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen flex-col">
      <div className="fixed z-50 p-4">
        <EditorFileMenu />
      </div>
      {children}
    </div>
  );
}
