import { TDxMachineContext } from "~/machine/context";
import { EditorCommandDialog } from "./editor-command-dialog";
import { EditorHeaderButton } from "./editor-header-button";

export const EditorHeaderHelpers = () => {
  const machineRef = TDxMachineContext.useActorRef();
  return (
    <div className="flex gap-4">
      <EditorHeaderButton
        onClick={() => machineRef.send({ type: "TOGGLE_COMMAND" })}
      >
        Press
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </EditorHeaderButton>
      <EditorHeaderButton
        onClick={() => {
          machineRef.send({ type: "CLEAR" });
        }}
      >
        Clear Canvas
      </EditorHeaderButton>
      <EditorCommandDialog />
    </div>
  );
};
