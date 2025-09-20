"use client";

import type { ReactNode } from "react";
import { useTemporaryMode } from "~/hooks/use-temporary-mode";

interface TemporaryModeWrapperProps {
  children: ReactNode;
}

// Provides a data attribute hook for Tailwind data-variants.
// Sets data-temp="true" when in temporary chat mode.
export function TemporaryModeWrapper({ children }: TemporaryModeWrapperProps) {
  const isTemporary = useTemporaryMode();
  return (
    <div
      data-temp={isTemporary ? "true" : "false"}
      className="group/temp flex h-screen w-full relative bg-transparent group-data-[temp=true]:bg-white group-data-[temp=true]:p-[32px_8px_8px_8px]"
    >
      {children}
    </div>
  );
}

