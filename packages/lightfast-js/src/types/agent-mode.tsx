import type React from "react";
import { z } from "zod";

export const $AgentMode = z.enum(["agent", "manual"]);
export type AgentMode = z.infer<typeof $AgentMode>;

export interface AgentModeConfig {
  title: string;
  description: string;
  icon: React.ReactNode;
}
