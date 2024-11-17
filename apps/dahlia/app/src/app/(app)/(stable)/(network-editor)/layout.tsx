"use client";

import { TDxMachineContext } from "~/machine/context";
import { EditorHeader } from "./components/app/editor-header";

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
