"use client";

import { ReactNode } from "react";

interface SearchTabContentProps {
  children: ReactNode;
}

export function SearchTabContent({ children }: SearchTabContentProps) {
  return <div className="flex-1 overflow-auto min-h-0 p-4">{children}</div>;
}
