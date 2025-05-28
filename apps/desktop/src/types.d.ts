import { BlenderConnectionStatus } from "./helpers/ipc/blender/blender-context";

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
  newWindow: () => Promise<void>;
  getInfo: () => Promise<{
    index: number;
    total: number;
    id: number;
    uniqueId: string;
  }>;
}

interface BlenderConnectionAPI {
  onStatusUpdate: (
    callback: (status: BlenderConnectionStatus) => void,
  ) => () => void;
  getStatus: () => Promise<BlenderConnectionStatus>;
  getPort: () => Promise<number>;
  setPort: (port: number) => Promise<boolean>;
  sendToBlender: (message: object) => Promise<any>;
  executeCode: (code: string) => Promise<any>;
  getSceneInfo: () => Promise<any>;
  getShaderState: () => Promise<any>;
  onMessageResponse: (callback: (message: any) => void) => () => void;
}

declare global {
  interface Window {
    electronWindow: ElectronWindow;
    blenderConnection: BlenderConnectionAPI;
    themeMode: ThemeModeContext;
  }
}

export {};
