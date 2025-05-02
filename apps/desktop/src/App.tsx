import React, { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { queryClient } from "@repo/trpc-client/trpc-react-proxy-provider";

import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { router } from "./routes/router";
import { useBlenderStore } from "./stores/blender-store";

import "./styles.css";

import { EnvProvider } from "./providers/env-provider";

export default function App() {
  // This ref needs to be at the top level of the component, not inside useEffect
  const hasInitializedBlenderListener = React.useRef(false);
  const initializeListener = useBlenderStore(
    (state) => state.initializeListener,
  );

  useEffect(() => {
    syncThemeWithLocal();
  }, []);

  // Initialize Blender connection status listener
  useEffect(() => {
    // Don't initialize more than once in development due to StrictMode
    if (!hasInitializedBlenderListener.current) {
      console.log("Initializing Blender status listener from App component");
      const cleanup = initializeListener();
      hasInitializedBlenderListener.current = true;

      // Return cleanup function to remove listener when component unmounts
      return () => {
        console.log("Cleaning up Blender status listener");
        cleanup();
        // Don't reset the ref in the cleanup, as that would allow double-initialization
        // during React's StrictMode unmount/remount cycle
      };
    }

    // Return a no-op cleanup if we didn't initialize
    return () => {};
  }, []);

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      {/* <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      > */}
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
      {/* </ClerkProvider> */}
    </div>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <EnvProvider>
      <App />
    </EnvProvider>
  </React.StrictMode>,
);
