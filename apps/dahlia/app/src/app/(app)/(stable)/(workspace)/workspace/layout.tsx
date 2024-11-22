import { EditorHeaderMenu } from "./components/app/editor-header-file";

export default function NetworkEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* <ReactFlowProvider> */}
      <EditorHeaderMenu />
      {/* <EditorHeaderHelpers /> */}
      {children}
      {/* </ReactFlowProvider> */}
    </>
  );
}
