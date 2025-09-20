"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * Returns true when the user is in temporary chat mode.
 * Currently scoped to /new with either ?mode=temporary or ?temporary=1.
 */
export function useTemporaryMode() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const temporary = searchParams.get("temporary");
  return pathname === "/new" && (mode === "temporary" || temporary === "1");
}

