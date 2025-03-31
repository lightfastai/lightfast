"use client";

import { useActiveView } from "../hooks/use-active-view";
import { ActiveView } from "../types/active-view";

export const WorkspaceViewProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { setActiveView } = useActiveView();

  return (
    <div
      onClick={() => setActiveView(ActiveView.WORKSPACE)}
      className="h-full w-full"
    >
      {children}
    </div>
  );
};
