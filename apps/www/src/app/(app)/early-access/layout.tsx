import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

export default function EarlyAccessLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
