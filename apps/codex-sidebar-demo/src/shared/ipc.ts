export const IPC_NAMESPACE = "codex_sidebar_demo";

const channel = (name: string) => `${IPC_NAMESPACE}:${name}` as const;

export const IpcChannels = {
  getSystemThemeVariant: channel("get-system-theme-variant"),
  systemThemeVariantUpdated: channel("system-theme-variant-updated"),
  showContextMenu: channel("show-context-menu"),
  openExternal: channel("open-external"),
  openWindow: channel("open-window"),
  getBuildInfoSync: channel("get-build-info-sync"),
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

export type WindowKind = "primary" | "secondary" | "hud";

export interface BuildInfoSnapshot {
  buildFlavor: "dev" | "preview" | "prod";
  buildNumber: string;
  name: string;
  sparkleFeedUrl: string;
  sparklePublicKey: string;
  version: string;
}

export interface LightfastBridge {
  buildInfo: BuildInfoSnapshot;
  getSystemThemeVariant: () => Promise<SystemThemeVariant>;
  onSystemThemeVariantUpdated: (
    listener: (variant: SystemThemeVariant) => void
  ) => () => void;
  openExternal: (url: string) => Promise<void>;
  openWindow: (kind: WindowKind) => Promise<void>;
  platform: Platform;
}
