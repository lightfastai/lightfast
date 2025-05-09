import { BlenderConnectionStatus } from "../main/blender-connection";

interface ElectronAPI {
  getClientEnv: () => Promise<any>;
  ping: () => Promise<string>;
  send: (channel: string, ...args: any[]) => void;
  on: (channel: string, listener: (...args: any[]) => void) => () => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

interface BlenderConnectionAPI {
  onStatusUpdate: (
    callback: (status: BlenderConnectionStatus) => void,
  ) => () => void;
  getStatus: () => Promise<BlenderConnectionStatus>;
  sendToBlender: (message: object) => Promise<any>;
  executeCode: (code: string) => Promise<any>;
  getState: () => Promise<any>;
  onMessageResponse: (callback: (message: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    blenderConnection: BlenderConnectionAPI;
  }
}

export {};
