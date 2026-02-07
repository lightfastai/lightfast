import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PipelineConfig } from "./types.js";

const CONFIG_PATH = resolve(
  import.meta.dirname,
  "../pipeline.config.json"
);

export function loadConfig(): PipelineConfig {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as PipelineConfig;
}
