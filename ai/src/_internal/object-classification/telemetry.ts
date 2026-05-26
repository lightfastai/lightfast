import type { LanguageModel, LanguageModelUsage } from "@vendor/ai";

export function getModelName(model: LanguageModel): string {
  if (typeof model === "string") {
    return model;
  }

  return `${model.provider}/${model.modelId}`;
}

export function formatFinishReason(finishReason: unknown): string {
  if (typeof finishReason === "string") {
    return finishReason;
  }

  if (
    finishReason &&
    typeof finishReason === "object" &&
    "unified" in finishReason &&
    typeof finishReason.unified === "string"
  ) {
    return finishReason.unified;
  }

  return String(finishReason);
}

export function formatUsage(usage: LanguageModelUsage): Record<string, number> {
  const inputTokens = readTokenTotal(usage.inputTokens);
  const outputTokens = readTokenTotal(usage.outputTokens);

  return Object.fromEntries(
    Object.entries({
      inputTokens,
      outputTokens,
      totalTokens:
        typeof inputTokens === "number" && typeof outputTokens === "number"
          ? inputTokens + outputTokens
          : usage.totalTokens,
    }).filter(([, value]) => typeof value === "number")
  ) as Record<string, number>;
}

function readTokenTotal(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "total" in value &&
    typeof value.total === "number"
  ) {
    return value.total;
  }

  return;
}
