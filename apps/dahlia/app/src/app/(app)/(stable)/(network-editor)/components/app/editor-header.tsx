import { EditorHeaderFile } from "./editor-header-file";
import { EditorHeaderHelpers } from "./editor-header-helpers";

export function EditorHeader() {
  return (
    <section className="flex items-center justify-between border-b p-1">
      <EditorHeaderFile />
      <EditorHeaderHelpers />
    </section>
  );
}
