import { Sandbox } from "@vendor/vercel-sandbox";
import type {
  SandboxCommand,
  SandboxCreateInput,
  SandboxExecInput,
  SandboxHandle,
  SandboxNetworkPolicy,
  SandboxRuntime,
} from "./types";

type VercelSandbox = Awaited<ReturnType<typeof Sandbox.get>>;
type VercelCommand = Awaited<ReturnType<VercelSandbox["runCommand"]>>;

function wrapCommand(command: VercelCommand): SandboxCommand {
  return {
    id: "cmdId" in command ? command.cmdId : "unknown",
    logs: () => command.logs(),
    wait: async () => {
      const finished = await command.wait();
      return { exitCode: finished.exitCode };
    },
    stdout: () => command.stdout(),
    stderr: () => command.stderr(),
    kill: async () => {
      await command.kill();
    },
  };
}

function wrapSandbox(sandbox: VercelSandbox): SandboxHandle {
  return {
    id: sandbox.name,
    get status() {
      return sandbox.status;
    },
    async writeFiles(files) {
      await sandbox.writeFiles(files);
    },
    async readFileToBuffer(path) {
      return await sandbox.readFileToBuffer({ path });
    },
    async exec(input: SandboxExecInput) {
      const command = await sandbox.runCommand({
        cmd: input.cmd,
        args: input.args,
        cwd: input.cwd,
        detached: input.detached ?? false,
        env: input.env,
        timeoutMs: input.timeoutMs,
      });

      return wrapCommand(command);
    },
    async updateNetworkPolicy(policy: SandboxNetworkPolicy) {
      await sandbox.updateNetworkPolicy(policy);
    },
    async stop() {
      await sandbox.stop();
    },
  };
}

export function createVercelSandboxRuntime(): SandboxRuntime {
  return {
    async create(input: SandboxCreateInput = {}) {
      const sandbox = await Sandbox.create({
        name: input.name,
        runtime: input.runtime ?? "node24",
        timeout: input.timeoutMs,
        resources: input.resources?.vcpus
          ? { vcpus: input.resources.vcpus }
          : undefined,
        networkPolicy: input.networkPolicy,
        ports: input.ports,
      });

      return wrapSandbox(sandbox);
    },
    async get(id) {
      const sandbox = await Sandbox.get({ name: id });
      return wrapSandbox(sandbox);
    },
    async destroy(id) {
      const sandbox = await Sandbox.get({ name: id });
      await sandbox.stop();
    },
  };
}
