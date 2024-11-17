import { EditorHeaderFile } from "./editor-header-file";
import { EditorHeaderHelpers } from "./editor-header-helpers";

export function EditorHeader() {
  return (
    <section className="flex h-[3rem] items-center justify-between border-b p-1.5">
      <EditorHeaderFile />
      <EditorHeaderHelpers />
    </section>
  );
}
