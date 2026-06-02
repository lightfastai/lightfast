import type { Server } from "node:http";

import {
  type AppEnv,
  createServer,
  type FetchHandler,
  type Hono,
  type ServerOptions,
  type ServicePlugin,
  type Store,
  serve,
  type TokenMap,
  type WebhookDispatcher,
} from "@emulators/core";

export type EmulatorServer = ReturnType<typeof createServer>;

export interface StartEmulatorContext {
  appOrigin?: string;
  publicOrigin?: string;
  /** Re-run seeding (store.reset() + seed). Wired to the emulator's reset(). */
  reset(): void;
}

export interface StartEmulatorOptions extends ServerOptions {
  appOrigin?: string;
  /** Wrap the fetch handler (e.g. host-routing shims). Default: server.app.fetch. */
  createFetch?(server: EmulatorServer, ctx: StartEmulatorContext): FetchHandler;
  host?: string;
  /** Mutate the server before it starts listening (e.g. override webhooks.dispatch). */
  onReady?(server: EmulatorServer): void;
  port?: number;
  publicOrigin?: string;
  /** Override seeding. Default: store.reset() then plugin.seed(store, publicOrigin). */
  seed?(server: EmulatorServer, ctx: StartEmulatorContext): void;
}

export interface StartedEmulator {
  app: Hono<AppEnv>;
  close(): Promise<void>;
  listenUrl: string;
  publicOrigin: string;
  reset(): void;
  store: Store;
  tokenMap: TokenMap;
  url: string;
  webhooks: WebhookDispatcher;
}

export function formatListenUrl(host: string, port: number): string {
  const urlHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  const formattedHost = urlHost.includes(":") ? `[${urlHost}]` : urlHost;
  return `http://${formattedHost}:${port}`;
}

export function waitForListening(httpServer: Server): Promise<void> {
  if (httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      httpServer.off("error", onError);
      httpServer.off("listening", onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };

    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
  });
}

export function closeServer(httpServer: Server): Promise<void> {
  if (!httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function startEmulator(
  plugin: ServicePlugin,
  options: StartEmulatorOptions = {}
): Promise<StartedEmulator> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;

  const server = createServer(plugin, {
    appKeyResolver: options.appKeyResolver,
    baseUrl: options.publicOrigin,
    docsUrl: options.docsUrl,
    fallbackUser: options.fallbackUser,
    port: port || undefined,
    tokens: options.tokens,
  });

  const runSeed = () => {
    if (options.seed) {
      options.seed(server, ctx);
      return;
    }
    server.store.reset();
    plugin.seed?.(server.store, options.publicOrigin ?? "");
  };

  const ctx: StartEmulatorContext = {
    appOrigin: options.appOrigin,
    publicOrigin: options.publicOrigin,
    reset: runSeed,
  };

  runSeed();
  options.onReady?.(server);

  const fetchHandler: FetchHandler = options.createFetch
    ? options.createFetch(server, ctx)
    : server.app.fetch;

  const httpServer = serve({
    fetch: fetchHandler,
    hostname: host,
    port,
  });

  await waitForListening(httpServer).catch(async (error: unknown) => {
    await closeServer(httpServer).catch(() => undefined);
    throw error;
  });

  const address = httpServer.address();
  const resolvedPort =
    typeof address === "object" && address ? address.port : port;
  const listenUrl = formatListenUrl(host, resolvedPort);
  const publicOrigin = options.publicOrigin ?? listenUrl;

  let closed = false;

  return {
    app: server.app,
    store: server.store,
    webhooks: server.webhooks,
    tokenMap: server.tokenMap,
    listenUrl,
    publicOrigin,
    url: listenUrl,
    reset: runSeed,
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await closeServer(httpServer);
    },
  };
}
