import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "@repo/trpc-client/trpc-react-proxy-provider";

import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { useBlenderListener } from "./hooks/use-blender-listener";

import "./styles.css";

import { AppRouter, composerRouter, indexRouter } from "./routes/router";
import { Networks } from "./types/network";
import { Renderer } from "./types/renderer";

export default function App({
  network,
  renderer = "index",
}: {
  network: Networks;
  renderer?: Renderer;
}) {
  useBlenderListener(network);

  useEffect(() => {
    syncThemeWithLocal();
  }, []);

  let selectedRouter: AppRouter | null = null;
  switch (renderer) {
    case "index":
      selectedRouter = indexRouter;
      break;
    case "composer":
      selectedRouter = composerRouter;
      break;
  }

  if (!selectedRouter) {
    throw new Error("No router found");
  }

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      {/* <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      > */}
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={selectedRouter} defaultPreload="intent" />
      </QueryClientProvider>
      {/* </ClerkProvider> */}
    </div>
  );
}
