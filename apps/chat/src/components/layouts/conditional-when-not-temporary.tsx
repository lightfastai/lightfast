"use client";

import type { ReactNode } from "react";
import { useTemporaryMode } from "~/hooks/use-temporary-mode";

export function ConditionalWhenNotTemporary({ children }: { children: ReactNode }) {
  const isTemporary = useTemporaryMode();
  if (isTemporary) return null;
  return <>{children}</>;
}

export function ConditionalWhenTemporary({ children }: { children: ReactNode }) {
  const isTemporary = useTemporaryMode();
  if (!isTemporary) return null;
  return <>{children}</>;
}
