export const IPC_NAMESPACE = "codex_sidebar_demo";

const channel = (name: string) => `${IPC_NAMESPACE}:${name}` as const;

export const IpcChannels = {
  getSystemThemeVariant: channel("get-system-theme-variant"),
  systemThemeVariantUpdated: channel("system-theme-variant-updated"),
  showContextMenu: channel("show-context-menu"),
  openExternal: channel("open-external"),
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export type SystemThemeVariant = "light" | "dark";

export type Platform =
  | "aix"
  | "android"
  | "darwin"
  | "freebsd"
  | "haiku"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32"
  | "cygwin"
  | "netbsd";

export interface LightfastBridge {
  getSystemThemeVariant: () => Promise<SystemThemeVariant>;
  onSystemThemeVariantUpdated: (
    listener: (variant: SystemThemeVariant) => void
  ) => () => void;
  openExternal: (url: string) => Promise<void>;
  platform: Platform;
}

export type WindowKind = "primary" | "secondary" | "hud";
