import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import type { FormatPlatform } from "../../../shared/accelerators";
import type { BuildInfoSnapshot } from "../../../shared/ipc";
import { createPrimaryRouter } from "../router";

export interface PrimaryRouteContext {
  buildInfo: BuildInfoSnapshot;
  formatPlatform: FormatPlatform;
}

export function PrimaryRouter({
  buildInfo,
  formatPlatform,
}: PrimaryRouteContext) {
  const router = useMemo(
    () => createPrimaryRouter({ buildInfo, formatPlatform }),
    [buildInfo, formatPlatform]
  );

  return <RouterProvider router={router} />;
}
