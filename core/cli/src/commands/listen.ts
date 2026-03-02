import { Command } from "commander";
import pc from "picocolors";
import { getConfig } from "../lib/config.js";
import { getStreamUrl } from "../lib/api.js";
import { connectSSE } from "../lib/sse.js";

interface WebhookEvent {
  provider: string;
  deliveryId: string;
  eventType: string;
  resourceId: string | null;
  receivedAt: number;
  payload: unknown;
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

    console.log(
      `  Listening for events in ${pc.bold(config.orgName)}...`
    );
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
        if (event.event === "heartbeat") return;
        if (event.event !== "webhook") return;

        const data = JSON.parse(event.data) as WebhookEvent;

        if (opts.json) {
          console.log(JSON.stringify(data));
          return;
        }

        const time = new Date(data.receivedAt).toLocaleTimeString();
        const provider = colorProvider(data.provider);
        console.log(
          `  ${pc.dim(time)}  ${provider}  ${pc.bold(data.eventType)}  ${pc.dim(data.deliveryId.slice(0, 8))}`
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
