import { BlenderConnectionStatus } from "./preload";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

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
}

declare global {
  interface Window {
    // Existing electron API if defined here or elsewhere
    electron?: {
      ping: () => Promise<string>;
    };
    electronWindow?: ElectronWindow;
    blenderConnection: BlenderConnectionAPI;
    themeMode: ThemeModeContext;
  }
}
