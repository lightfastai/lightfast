import "server-only";

import { BraintrustExporter } from "@braintrust/otel";
import { registerOTel } from "@vercel/otel";

import { braintrustEnv } from "./env";

interface RegisterBraintrustOTelOptions {
  serviceName: string;
}

let isRegistered = false;

export function registerBraintrustOTel({
  serviceName,
}: RegisterBraintrustOTelOptions): { enabled: boolean } {
  if (!isBraintrustOTelEnabled()) {
    return { enabled: false };
  }

  if (isRegistered) {
    return { enabled: true };
  }

  const config = getBraintrustExporterConfig();

  registerOTel({
    serviceName,
    traceExporter: new BraintrustExporter({
      ...config,
      filterAISpans: true,
    }),
  });
  isRegistered = true;

  return { enabled: true };
}

function isBraintrustOTelEnabled(): boolean {
  return (
    braintrustEnv.BRAINTRUST_OTEL_ENABLED === "1" ||
    braintrustEnv.BRAINTRUST_OTEL_ENABLED === "true"
  );
}

function getBraintrustExporterConfig(): {
  apiKey: string;
  apiUrl?: string;
  parent: string;
} {
  const missing = [
    ["BRAINTRUST_API_KEY", braintrustEnv.BRAINTRUST_API_KEY],
    ["BRAINTRUST_PARENT", braintrustEnv.BRAINTRUST_PARENT],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Braintrust OTel is enabled but missing required env: ${missing.join(", ")}`
    );
  }

  return {
    apiKey: braintrustEnv.BRAINTRUST_API_KEY as string,
    ...(braintrustEnv.BRAINTRUST_API_URL && {
      apiUrl: braintrustEnv.BRAINTRUST_API_URL,
    }),
    parent: braintrustEnv.BRAINTRUST_PARENT as string,
  };
}
