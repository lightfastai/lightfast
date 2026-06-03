export interface EmulatorStartInput {
  callbackUrl?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export interface RunnableEmulator {
  close(): Promise<void>;
  listenUrl: string;
  publicOrigin: string;
}

export interface EmulatorManifest {
  env(input: {
    callbackUrl?: string;
    publicOrigin: string;
  }): Record<string, string>;
  name: string;
  port: number;
  start(input: EmulatorStartInput): Promise<RunnableEmulator>;
}
