export interface EmulatorStartInput {
  appOrigin?: string;
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
  env(appOrigin: string, emulatorOrigin: string): Record<string, string>;
  name: string;
  originEnvVar: string;
  port: number;
  start(input: EmulatorStartInput): Promise<RunnableEmulator>;
}
