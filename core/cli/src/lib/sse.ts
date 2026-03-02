import { EventSourceParserStream } from "eventsource-parser/stream";

interface SSEEvent {
  event: string;
  data: string;
  id?: string;
}

interface ConnectOptions {
  url: string;
  token: string;
  onEvent: (event: SSEEvent) => void;
  onConnect: () => void;
  onDisconnect: (reason: string) => void;
  signal?: AbortSignal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectSSE(opts: ConnectOptions): Promise<void> {
  let lastEventId = "";
  let retryMs = 1000;

  while (!opts.signal?.aborted) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.token}`,
        Accept: "text/event-stream",
      };
      if (lastEventId) headers["Last-Event-ID"] = lastEventId;

      const response = await fetch(opts.url, { headers, signal: opts.signal });
      if (!response.ok) {
        if (response.status === 401) {
          opts.onDisconnect(
            "API key invalid or expired. Run `lightfast login` again."
          );
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      retryMs = 1000;
      opts.onConnect();

      if (!response.body) throw new Error("No response body");
      const stream = response
        .body.pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream());

      for await (const event of stream) {
        if (opts.signal?.aborted) break;
        if (event.id) lastEventId = event.id;
        opts.onEvent({
          event: event.event ?? "message",
          data: event.data,
          id: event.id,
        });
      }

      // Stream ended (Vercel 300s limit) — reconnect
      opts.onDisconnect("Reconnecting...");
    } catch {
      if (opts.signal?.aborted) return;
      opts.onDisconnect(`Connection lost. Reconnecting in ${retryMs / 1000}s...`);
      await sleep(retryMs);
      retryMs = Math.min(retryMs * 2, 30_000);
    }
  }
}
