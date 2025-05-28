import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "@repo/trpc-client/trpc-react-proxy-provider";

import { syncThemeWithLocal } from "./helpers/theme-helpers";
import { useBlenderListener } from "./hooks/use-blender-listener";
import { AppRouter, composerRouter } from "./routes/router";
import { Networks } from "./types/network";

export default function App({ network }: { network: Networks }) {
  useBlenderListener(network);

  useEffect(() => {
    syncThemeWithLocal();
  }, []);

  let selectedRouter: AppRouter | null = null;
  switch (network) {
    case "blender":
      selectedRouter = composerRouter;
      break;
  }

  if (!selectedRouter) {
    throw new Error("No router found");
  }

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={selectedRouter} defaultPreload="intent" />
      </QueryClientProvider>
    </div>
  );
}
