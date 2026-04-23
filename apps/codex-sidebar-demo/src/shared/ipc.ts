export const IPC_NAMESPACE = "codex_sidebar_demo";

const channel = (name: string) => `${IPC_NAMESPACE}:${name}` as const;

export const IpcChannels = {
  getSystemThemeVariant: channel("get-system-theme-variant"),
  systemThemeVariantUpdated: channel("system-theme-variant-updated"),
  showContextMenu: channel("show-context-menu"),
  openExternal: channel("open-external"),
  openWindow: channel("open-window"),
  getBuildInfoSync: channel("get-build-info-sync"),
  getSentryInitOptionsSync: channel("get-sentry-init-options-sync"),
  rendererError: channel("renderer-error"),
  updaterCheck: channel("updater-check"),
  updaterInstall: channel("updater-install"),
  updaterStatusSync: channel("updater-status-sync"),
  updaterStatusChanged: channel("updater-status-changed"),
  menuAction: channel("menu-action"),
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

export interface SentryInitSnapshot {
  dsn: string;
  enabled: boolean;
  environment: string;
  release: string;
}

export interface RendererErrorPayload {
  kind: "error" | "unhandledrejection";
  message: string;
  source?: string;
  stack?: string;
  url?: string;
}

export type UpdaterState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdaterStatusSnapshot {
  message?: string;
  progress?: number;
  state: UpdaterState;
}

import type { AcceleratorName } from "./accelerators";

export interface LightfastBridge {
  buildInfo: BuildInfoSnapshot;
  getSystemThemeVariant: () => Promise<SystemThemeVariant>;
  onMenuAction: (
    listener: (action: AcceleratorName) => void
  ) => () => void;
  onSystemThemeVariantUpdated: (
    listener: (variant: SystemThemeVariant) => void
  ) => () => void;
  onUpdaterStatusChanged: (
    listener: (status: UpdaterStatusSnapshot) => void
  ) => () => void;
  openExternal: (url: string) => Promise<void>;
  openWindow: (kind: WindowKind) => Promise<void>;
  platform: Platform;
  reportError: (payload: RendererErrorPayload) => void;
  sentryInit: SentryInitSnapshot;
  updater: {
    status: UpdaterStatusSnapshot;
    check: () => Promise<{ ok: boolean; reason?: string }>;
    install: () => Promise<void>;
  };
}
