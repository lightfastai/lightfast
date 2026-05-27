import { useEffect, useState } from "react";
import type { AuthSnapshot } from "../../../shared/ipc";

export function useAuthSnapshot(): AuthSnapshot {
  const [auth, setAuth] = useState<AuthSnapshot>(
    () => window.lightfastBridge.auth.snapshot
  );

  useEffect(() => window.lightfastBridge.auth.onChanged(setAuth), []);

  return auth;
}
