"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface BrowserState {
  url: string | null;
  screenshot: string | null;
  isLoading: boolean;
}

interface BrowserContextValue {
  browserState: BrowserState;
  updateBrowserState: (update: Partial<BrowserState>) => void;
}

const BrowserContext = createContext<BrowserContextValue | undefined>(undefined);

export function BrowserProvider({ children }: { children: ReactNode }) {
  const [browserState, setBrowserState] = useState<BrowserState>({
    url: null,
    screenshot: null,
    isLoading: false,
  });

  const updateBrowserState = (update: Partial<BrowserState>) => {
    setBrowserState((prev) => ({ ...prev, ...update }));
  };

  return (
    <BrowserContext.Provider value={{ browserState, updateBrowserState }}>
      {children}
    </BrowserContext.Provider>
  );
}

export function useBrowser() {
  const context = useContext(BrowserContext);
  if (!context) {
    throw new Error("useBrowser must be used within a BrowserProvider");
  }
  return context;
}