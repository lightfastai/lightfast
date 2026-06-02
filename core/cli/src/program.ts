import type { NativeSession } from "@repo/native-auth-contract";
import { Command } from "commander";
import { CliAuthError } from "./auth/errors";
import { login as defaultLogin } from "./auth/login-flow";
import { clearSession, type SessionStoreLike } from "./auth/session";
import { SessionStore } from "./auth/store";
import { registerProxyCommands } from "./proxy/commands";

interface ProgramDeps {
  appUrl?: string;
  fetchImpl?: typeof fetch;
  login?: (input?: Record<string, never>) => Promise<NativeSession>;
  stdout?: NodeJS.WritableStream;
  store?: SessionStoreLike;
  version?: string;
}

function write(
  stream: NodeJS.WritableStream | undefined,
  message: string
): void {
  (stream ?? process.stdout).write(message);
}

function sessionUserLabel(session: NativeSession): string {
  return session.user.email ?? session.user.id;
}

function sessionOrgLabel(session: NativeSession): string {
  return session.organization.slug
    ? `${session.organization.name} (${session.organization.slug})`
    : session.organization.name;
}

export function createProgram(deps: ProgramDeps = {}) {
  const program = new Command();
  const login = deps.login ?? defaultLogin;
  const store = deps.store ?? new SessionStore();

  program
    .name("lightfast")
    .description("Lightfast CLI")
    .version(deps.version ?? "0.1.0");

  program
    .command("login")
    .description("Sign in to Lightfast")
    .action(async () => {
      const session = await login({});
      write(
        deps.stdout,
        `Logged in as ${sessionUserLabel(session)} for ${sessionOrgLabel(session)}.\n`
      );
    });

  program
    .command("whoami")
    .description("Show the current Lightfast CLI session")
    .action(async () => {
      const session = await store.get();
      if (!session) {
        throw new CliAuthError(
          "NOT_LOGGED_IN",
          "Not signed in. Run `lightfast login`."
        );
      }

      write(deps.stdout, `User: ${sessionUserLabel(session)}\n`);
      write(deps.stdout, `Organization: ${sessionOrgLabel(session)}\n`);
      write(deps.stdout, `App: ${session.appUrl}\n`);
    });

  program
    .command("logout")
    .description("Sign out of Lightfast")
    .action(async () => {
      await clearSession(store);
      write(deps.stdout, "Logged out of Lightfast.\n");
    });

  registerProxyCommands(program, {
    appUrl: deps.appUrl,
    fetchImpl: deps.fetchImpl,
    stdout: deps.stdout,
    store,
  });

  return program;
}
