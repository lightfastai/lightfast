"use client";

import { EditorHeader } from "./components/app/editor-header";
import { TDxMachineContext } from "./state/context";

export default function NetworkEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full">
      <TDxMachineContext.Provider>
        <EditorHeader />
        {children}
      </TDxMachineContext.Provider>
    </div>
  );
}
