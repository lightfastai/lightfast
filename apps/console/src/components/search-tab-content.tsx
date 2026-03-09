"use client";

import type { ReactNode } from "react";

interface SearchTabContentProps {
  children: ReactNode;
}

export function SearchTabContent({ children }: SearchTabContentProps) {
  return <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>;
}
