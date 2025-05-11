import { useEffect, useRef } from "react";

import { useBlenderStore } from "../stores/blender-store";
import { Networks } from "../types/network";

/**
 * Hook to initialize the Blender connection listener if the network is 'blender'.
 * Ensures listener is only initialized once (even in React StrictMode).
 * Returns nothing; side-effect only.
 */
export function useBlenderListener(network: Networks) {
  const hasInitializedBlenderListener = useRef(false);
  const initializeListener = useBlenderStore(
    (state) => state.initializeListener,
  );

  useEffect(() => {
    if (network !== "blender") return;
    if (!hasInitializedBlenderListener.current) {
      // Only initialize status listener once
      const cleanup = initializeListener();
      hasInitializedBlenderListener.current = true;

      // Return cleanup function
      return () => {
        cleanup();
      };
    }
    // No-op cleanup if not initialized
    return () => {};
  }, [network, initializeListener]);
}
