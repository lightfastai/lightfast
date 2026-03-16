import { Command } from "commander";
import pc from "picocolors";
import { getStreamUrl } from "../lib/api.js";
import { getConfig } from "../lib/config.js";
import { connectSSE } from "../lib/sse.js";

interface SourceEventNotification {
  payloadId: number;
  sourceEvent: {
    provider: string;
    eventType: string;
    sourceId: string;
    title: string;
    occurredAt: string;
  };
}

interface CatchUpEvent {
  catchUp: true;
  deliveryId: string;
  eventType: string;
  payloadId: number;
  receivedAt: number;
  source: string;
}

export const listenCommand = new Command("listen")
  .description("Stream real-time webhook events")
  .option("--json", "Output raw JSON events")
  .action(async (opts: { json?: boolean }) => {
    const config = getConfig();
    if (!config) {
      console.log(pc.red("  Not logged in. Run `lightfast login` first."));
      process.exit(1);
    }

    console.log(`  Listening for events in ${pc.bold(config.orgName)}...`);
    console.log(pc.dim("  Press Ctrl+C to stop."));
    console.log();

    const controller = new AbortController();
    process.on("SIGINT", () => {
      console.log();
      controller.abort();
    });

    await connectSSE({
      url: getStreamUrl(),
      token: config.apiKey,
      signal: controller.signal,
      onConnect: () => {
        console.log(pc.green("  Connected."));
      },
      onDisconnect: (reason) => {
        console.log(pc.yellow(`  ${reason}`));
      },
      onEvent: (event) => {
        if (event.event === "connected") {
          return;
        }

        if (event.event !== "event") {
          return;
        }

        const data = JSON.parse(event.data) as
          | SourceEventNotification
          | CatchUpEvent;

        if (opts.json) {
          console.log(JSON.stringify(data));
          return;
        }

        // Catch-up events have lightweight shape
        if ("catchUp" in data) {
          const e = data;
          const time = new Date(e.receivedAt).toLocaleTimeString();
          const source = colorProvider(e.source);
          console.log(
            `  ${pc.dim(time)}  ${source}  ${pc.bold(e.eventType)}  ${pc.dim(`#${e.payloadId}`)}`
          );
          return;
        }

        // Real-time events have full PostTransformEvent
        const e = data;
        const time = new Date(e.sourceEvent.occurredAt).toLocaleTimeString();
        const source = colorProvider(e.sourceEvent.provider);
        console.log(
          `  ${pc.dim(time)}  ${source}  ${pc.bold(e.sourceEvent.eventType)}  ${e.sourceEvent.title}`
        );
      },
    });
  });

function colorProvider(p: string): string {
  switch (p) {
    case "github":
      return pc.white(p);
    case "vercel":
      return pc.cyan(p);
    case "linear":
      return pc.magenta(p);
    case "sentry":
      return pc.red(p);
    default:
      return pc.gray(p);
  }
}
