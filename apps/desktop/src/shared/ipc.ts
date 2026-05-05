export const IPC_NAMESPACE = "lightfast_desktop";

const channel = (name: string) => `${IPC_NAMESPACE}:${name}` as const;

export const IpcChannels = {
  getSystemThemeVariant: channel("get-system-theme-variant"),
  systemThemeVariantUpdated: channel("system-theme-variant-updated"),
  openApp: channel("open-app"),
  openWindow: channel("open-window"),
  getBuildInfoSync: channel("get-build-info-sync"),
  getSentryInitOptionsSync: channel("get-sentry-init-options-sync"),
  rendererError: channel("renderer-error"),
  updaterCheck: channel("updater-check"),
  updaterInstall: channel("updater-install"),
  updaterStatusSync: channel("updater-status-sync"),
  updaterStatusChanged: channel("updater-status-changed"),
  menuAction: channel("menu-action"),
  getSettingsSync: channel("get-settings-sync"),
  updateSetting: channel("update-setting"),
  settingsChanged: channel("settings-changed"),
  authSnapshotSync: channel("auth-snapshot-sync"),
  authGetToken: channel("auth-get-token"),
  authSignIn: channel("auth-sign-in"),
  authSignOut: channel("auth-sign-out"),
  authChanged: channel("auth-changed"),
  runtimeConfigSync: channel("runtime-config-sync"),
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

export type WindowKind = "primary" | "settings" | "hud";

export interface BuildInfoSnapshot {
  buildFlavor: "dev" | "preview" | "prod";
  buildNumber: string;
  name: string;
  sparkleFeedUrl: string;
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

export type ThemeSource = "system" | "light" | "dark";

export interface SettingsSnapshot {
  checkForUpdatesAutomatically: boolean;
  launchAtLogin: boolean;
  showInMenuBar: boolean;
  themeSource: ThemeSource;
}

export interface AuthSnapshot {
  isSignedIn: boolean;
}

export interface RuntimeConfigSnapshot {
  appOrigin: string;
}

export interface LightfastBridge {
  appOrigin: string;
  auth: {
    snapshot: AuthSnapshot;
    getToken: () => Promise<string | null>;
    signIn: () => Promise<string | null>;
    signOut: () => Promise<void>;
    onChanged: (listener: (snapshot: AuthSnapshot) => void) => () => void;
  };
  buildInfo: BuildInfoSnapshot;
  getSystemThemeVariant: () => Promise<SystemThemeVariant>;
  onMenuAction: (listener: (action: AcceleratorName) => void) => () => void;
  onSettingsChanged: (
    listener: (snapshot: SettingsSnapshot) => void
  ) => () => void;
  onSystemThemeVariantUpdated: (
    listener: (variant: SystemThemeVariant) => void
  ) => () => void;
  onUpdaterStatusChanged: (
    listener: (status: UpdaterStatusSnapshot) => void
  ) => () => void;
  openApp: () => Promise<void>;
  openWindow: (kind: WindowKind) => Promise<void>;
  platform: Platform;
  reportError: (payload: RendererErrorPayload) => void;
  sentryInit: SentryInitSnapshot;
  settings: SettingsSnapshot;
  updater: {
    status: UpdaterStatusSnapshot;
    check: () => Promise<{ ok: boolean; reason?: string }>;
    install: () => Promise<void>;
  };
  updateSetting: <K extends keyof SettingsSnapshot>(
    key: K,
    value: SettingsSnapshot[K]
  ) => Promise<SettingsSnapshot>;
}
