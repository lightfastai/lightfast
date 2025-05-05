import type { EnvClient } from "./env/client-types";
import { BlenderConnectionStatus } from "./preload";

interface ThemeModeContext {
  toggle: () => Promise<boolean>;
  dark: () => Promise<void>;
  light: () => Promise<void>;
  system: () => Promise<boolean>;
  current: () => Promise<"dark" | "light" | "system">;
}
interface ElectronWindow {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}
interface BlenderConnectionAPI {
  onStatusUpdate: (
    callback: (status: BlenderConnectionStatus) => void,
  ) => () => void;
  sendToBlender: (message: object) => Promise<void>;
  getStatus: () => Promise<BlenderConnectionStatus>;
  executeCode: (code: string) => Promise<void>;
}

interface ElectronAPI {
  getClientEnv: () => Promise<EnvClient>;
  ping: () => Promise<string>;
  send: (channel: string, ...args: any[]) => void;
  on: (channel: string, listener: (...args: any[]) => void) => () => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

declare global {
  interface Window {
    electron?: {
      ping: () => Promise<string>;
    };
    electronAPI: ElectronAPI;
    electronWindow?: ElectronWindow;
    blenderConnection: BlenderConnectionAPI;
    themeMode: ThemeModeContext;
  }
}

export {};
