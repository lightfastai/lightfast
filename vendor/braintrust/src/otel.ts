import "server-only";

import { BraintrustExporter } from "@braintrust/otel";
import { registerOTel } from "@vercel/otel";

import { braintrustEnv } from "./env";

interface RegisterBraintrustOTelOptions {
  parent: string;
  serviceName: string;
}

let isRegistered = false;

export function registerBraintrustOTel({
  parent,
  serviceName,
}: RegisterBraintrustOTelOptions): { enabled: boolean } {
  if (isRegistered) {
    return { enabled: true };
  }

  registerOTel({
    serviceName,
    traceExporter: new BraintrustExporter({
      apiKey: braintrustEnv.BRAINTRUST_API_KEY,
      filterAISpans: true,
      parent,
    }),
  });
  isRegistered = true;

  return { enabled: true };
}
