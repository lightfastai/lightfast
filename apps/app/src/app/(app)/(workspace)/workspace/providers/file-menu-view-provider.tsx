"use client";

import { useActiveView } from "../hooks/use-active-view";
import { ActiveView } from "../types/active-view";

export const FileMenuViewProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { setActiveView } = useActiveView();
  return (
    <div
      onClick={() => setActiveView(ActiveView.FILE_MENU)}
      className="h-full w-full"
    >
      {children}
    </div>
  );
};
