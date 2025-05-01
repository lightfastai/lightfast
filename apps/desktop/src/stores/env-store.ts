import { create, StateCreator } from "zustand";

import type { EnvClient } from "../env/client-types";

interface EnvState {
  env: EnvClient | null;
  loading: boolean;
  error: Error | null;
}

interface EnvActions {
  fetchEnv: () => Promise<void>;
}

export type EnvStore = EnvState & EnvActions;

const envStoreInitializer: StateCreator<EnvStore> = (set) => ({
  env: null,
  loading: true,
  error: null,
  fetchEnv: async () => {
    set({ loading: true, error: null });
    try {
      if (typeof window.electronAPI?.getClientEnv !== "function") {
        throw new Error(
          "electronAPI.getClientEnv is not available. Ensure preload script is loaded correctly.",
        );
      }
      const clientEnv = await window.electronAPI.getClientEnv();
      set({ env: clientEnv, loading: false });
    } catch (err) {
      console.error("Failed to fetch client environment variables:", err);
      const error =
        err instanceof Error ? err : new Error("Failed to fetch env");
      set({ error, loading: false, env: null });
    }
  },
});

export const createEnvStore = () => create<EnvStore>(envStoreInitializer);
