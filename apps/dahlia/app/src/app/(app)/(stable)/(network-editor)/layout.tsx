"use client";

import { EditorHeader } from "./components/app/editor-header";
import { TDxMachineContext } from "./state/context";

export default function NetworkEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TDxMachineContext.Provider>
      <div className="fixed inset-0 flex flex-col">
        <EditorHeader />
        {children}
      </div>
    </TDxMachineContext.Provider>
  );
}
