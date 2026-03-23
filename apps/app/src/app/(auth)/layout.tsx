// perf/sign-in-isolation — STEP 0: bare auth layout (no ClerkProvider, no MFE link)
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
