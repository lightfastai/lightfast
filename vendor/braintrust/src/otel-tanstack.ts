import { BraintrustExporter } from "@braintrust/otel";
import { registerOTel } from "@vercel/otel";

interface RegisterBraintrustOTelOptions {
  apiKey?: string;
  parent: string;
  serviceName: string;
}

let isRegistered = false;

export function registerBraintrustOTel({
  apiKey = process.env.BRAINTRUST_API_KEY,
  parent,
  serviceName,
}: RegisterBraintrustOTelOptions): { enabled: boolean } {
  if (!apiKey) {
    return { enabled: false };
  }

  if (isRegistered) {
    return { enabled: true };
  }

  registerOTel({
    serviceName,
    traceExporter: new BraintrustExporter({
      apiKey,
      filterAISpans: true,
      parent,
    }),
  });
  isRegistered = true;

  return { enabled: true };
}
