import type {
  SandboxCommand,
  SandboxCommandResult,
  SandboxCreateInput,
  SandboxExecInput,
  SandboxFile,
  SandboxHandle,
  SandboxNetworkPolicy,
  SandboxRuntime,
} from "./types";

interface InMemoryRuntimeCalls {
  create: SandboxCreateInput[];
  destroy: string[];
  exec: SandboxExecInput[];
  get: string[];
  readFileToBuffer: string[];
  stop: string[];
  updateNetworkPolicy: SandboxNetworkPolicy[];
  writeFiles: SandboxFile[][];
}

export interface InMemorySandboxRuntime extends SandboxRuntime {
  calls: InMemoryRuntimeCalls;
}

export interface InMemorySandboxRuntimeOptions {
  commandResult?: SandboxCommandResult;
  stderr?: string;
  stdout?: string;
}

function createCommand(
  input: SandboxExecInput,
  options: Required<InMemorySandboxRuntimeOptions>,
): SandboxCommand {
  return {
    id: `cmd_${input.cmd}`,
    async *logs() {
      if (options.stdout) {
        yield { stream: "stdout" as const, data: options.stdout };
      }
      if (options.stderr) {
        yield { stream: "stderr" as const, data: options.stderr };
      }
    },
    async wait() {
      return options.commandResult;
    },
    async stdout() {
      return options.stdout;
    },
    async stderr() {
      return options.stderr;
    },
    async kill() {
      return undefined;
    },
  };
}

export function createInMemorySandboxRuntimeForTests(
  options: InMemorySandboxRuntimeOptions = {},
): InMemorySandboxRuntime {
  const resolvedOptions = {
    commandResult: options.commandResult ?? { exitCode: 0 },
    stderr: options.stderr ?? "",
    stdout: options.stdout ?? "",
  };
  const calls: InMemoryRuntimeCalls = {
    create: [],
    destroy: [],
    exec: [],
    get: [],
    readFileToBuffer: [],
    stop: [],
    updateNetworkPolicy: [],
    writeFiles: [],
  };

  function createHandle(id: string): SandboxHandle {
    return {
      id,
      status: "running",
      async writeFiles(files) {
        calls.writeFiles.push(files);
      },
      async readFileToBuffer(path) {
        calls.readFileToBuffer.push(path);
        return null;
      },
      async exec(input) {
        calls.exec.push(input);
        return createCommand(input, resolvedOptions);
      },
      async updateNetworkPolicy(policy) {
        calls.updateNetworkPolicy.push(policy);
      },
      async stop() {
        calls.stop.push(id);
      },
    };
  }

  return {
    calls,
    async create(input = {}) {
      calls.create.push(input);
      return createHandle(input.name ?? "sandbox_test");
    },
    async get(id) {
      calls.get.push(id);
      return createHandle(id);
    },
    async destroy(id) {
      calls.destroy.push(id);
    },
  };
}
