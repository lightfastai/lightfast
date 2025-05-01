import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { useStore } from "zustand";

import { createEnvStore, EnvStore } from "../stores/env-store"; // Import from new store file

// Define the store API type based on the factory function's return type
export type EnvStoreApi = ReturnType<typeof createEnvStore>;

// Create the context for the store API
const EnvStoreContext = createContext<EnvStoreApi | undefined>(undefined);

export const EnvProvider = ({ children }: { children: ReactNode }) => {
  // Use useRef to ensure the store is created only once
  const storeRef = useRef<EnvStoreApi>(null);
  if (!storeRef.current) {
    storeRef.current = createEnvStore();
  }

  // Fetch the environment variables when the provider mounts
  useEffect(() => {
    // Check if env has already been fetched or is loading to prevent multiple calls
    const { env, loading } = storeRef.current!.getState();
    if (!env && !loading) {
      storeRef.current!.getState().fetchEnv();
    }
    // We only want this effect to run once on mount, so the dependency array is empty.
    // The fetchEnv action itself handles the loading state internally.
  }, []);

  return (
    <EnvStoreContext.Provider value={storeRef.current}>
      {children}
    </EnvStoreContext.Provider>
  );
};

// Custom hook to access the Env store
export const useEnvStore = <T,>(selector: (store: EnvStore) => T): T => {
  const envStoreContext = useContext(EnvStoreContext);

  if (!envStoreContext) {
    throw new Error(`useEnvStore must be used within EnvProvider`);
  }

  return useStore(envStoreContext, selector);
};
