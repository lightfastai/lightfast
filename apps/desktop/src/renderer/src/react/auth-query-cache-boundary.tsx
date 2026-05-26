import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { AuthSnapshot } from "../../../shared/ipc";
import { hasAuthCacheBoundaryChanged } from "./auth-cache-boundary";

export function AuthQueryCacheBoundary() {
  const queryClient = useQueryClient();
  const authRef = useRef<AuthSnapshot>(window.lightfastBridge.auth.snapshot);

  useEffect(
    () =>
      window.lightfastBridge.auth.onChanged((next) => {
        if (hasAuthCacheBoundaryChanged(authRef.current, next)) {
          queryClient.clear();
        }
        authRef.current = next;
      }),
    [queryClient]
  );

  return null;
}
