import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import type { EnvClient } from "../env/client-types";

interface EnvContextType {
  env: EnvClient | null;
  loading: boolean;
  error: Error | null;
}

const EnvContext = createContext<EnvContextType | undefined>(undefined);

export const EnvProvider = ({ children }: { children: ReactNode }) => {
  const [env, setEnv] = useState<EnvClient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchEnv = async () => {
      try {
        // Use the Electron IPC mechanism defined in preload.ts
        const clientEnv = await window.electronAPI.getClientEnv();
        setEnv(clientEnv);
      } catch (err) {
        console.error("Failed to fetch client environment variables:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch env"));
      } finally {
        setLoading(false);
      }
    };

    fetchEnv();
  }, []);

  return (
    <EnvContext.Provider value={{ env, loading, error }}>
      {children}
    </EnvContext.Provider>
  );
};

export const useEnv = (): EnvContextType => {
  const context = useContext(EnvContext);
  if (context === undefined) {
    throw new Error("useEnv must be used within an EnvProvider");
  }
  return context;
};
