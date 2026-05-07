// Centralized names for globals exposed via contextBridge.exposeInMainWorld.
// Preload writes these names; renderer reads them. One file = no string drift.
export const BRIDGE_GLOBAL = "lightfastBridge" as const;
export const WINDOW_KIND_GLOBAL = "codexWindowType" as const;
