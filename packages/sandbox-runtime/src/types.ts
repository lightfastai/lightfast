import type { NetworkPolicy } from "@vendor/vercel-sandbox";

export type SandboxStatus =
  | "pending"
  | "running"
  | "stopping"
  | "stopped"
  | "failed"
  | (string & {});

export type SandboxRuntimeRuntime = "node24" | "node22" | "node26" | "python3.13";

export type SandboxNetworkPolicy = NetworkPolicy;

export interface SandboxCreateInput {
  name?: string;
  runtime?: SandboxRuntimeRuntime;
  timeoutMs?: number;
  resources?: {
    vcpus?: number;
  };
  networkPolicy?: SandboxNetworkPolicy;
  ports?: number[];
}

export interface SandboxFile {
  path: string;
  content: string | Uint8Array;
  mode?: number;
}

export interface SandboxExecInput {
  cmd: string;
  args?: string[];
  cwd?: string;
  detached?: boolean;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface SandboxLogChunk {
  stream: "stdout" | "stderr";
  data: string;
}

export interface SandboxCommandResult {
  exitCode: number | null;
}

export interface SandboxCommand {
  id: string;
  logs(): AsyncIterable<SandboxLogChunk>;
  wait(): Promise<SandboxCommandResult>;
  stdout(): Promise<string>;
  stderr(): Promise<string>;
  kill(): Promise<void>;
}

export interface SandboxHandle {
  id: string;
  status: SandboxStatus;
  writeFiles(files: SandboxFile[]): Promise<void>;
  readFileToBuffer(path: string): Promise<Buffer | null>;
  exec(input: SandboxExecInput): Promise<SandboxCommand>;
  updateNetworkPolicy(policy: SandboxNetworkPolicy): Promise<void>;
  stop(): Promise<void>;
}

export interface SandboxRuntime {
  create(input?: SandboxCreateInput): Promise<SandboxHandle>;
  get(id: string): Promise<SandboxHandle>;
  destroy(id: string): Promise<void>;
}
