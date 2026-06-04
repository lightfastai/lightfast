import type { NetworkPolicy } from "@vendor/vercel-sandbox";

export type SandboxStatus =
  | "pending"
  | "running"
  | "stopping"
  | "stopped"
  | "failed"
  | (string & {});

export type SandboxRuntimeRuntime =
  | "node24"
  | "node22"
  | "node26"
  | "python3.13";

export type SandboxNetworkPolicy = NetworkPolicy;

export interface SandboxCreateInput {
  name?: string;
  networkPolicy?: SandboxNetworkPolicy;
  ports?: number[];
  resources?: {
    vcpus?: number;
  };
  runtime?: SandboxRuntimeRuntime;
  timeoutMs?: number;
}

export interface SandboxFile {
  content: string | Uint8Array;
  mode?: number;
  path: string;
}

export interface SandboxExecInput {
  args?: string[];
  cmd: string;
  cwd?: string;
  detached?: boolean;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface SandboxLogChunk {
  data: string;
  stream: "stdout" | "stderr";
}

export interface SandboxCommandResult {
  exitCode: number | null;
}

export interface SandboxCommand {
  id: string;
  kill(): Promise<void>;
  logs(): AsyncIterable<SandboxLogChunk>;
  stderr(): Promise<string>;
  stdout(): Promise<string>;
  wait(): Promise<SandboxCommandResult>;
}

export interface SandboxHandle {
  exec(input: SandboxExecInput): Promise<SandboxCommand>;
  id: string;
  readFileToBuffer(path: string): Promise<Buffer | null>;
  status: SandboxStatus;
  stop(): Promise<void>;
  updateNetworkPolicy(policy: SandboxNetworkPolicy): Promise<void>;
  writeFiles(files: SandboxFile[]): Promise<void>;
}

export interface SandboxRuntime {
  create(input?: SandboxCreateInput): Promise<SandboxHandle>;
  destroy(id: string): Promise<void>;
  get(id: string): Promise<SandboxHandle>;
}
