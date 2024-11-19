import { EditorHeaderFile } from "./editor-header-file";
import { EditorHeaderHelpers } from "./editor-header-helpers";

export function EditorHeader() {
  return (
    <section className="fixed inset-x-0 top-0 z-[1] flex items-center justify-between p-4">
      <EditorHeaderFile />
      <EditorHeaderHelpers />
    </section>
  );
}
