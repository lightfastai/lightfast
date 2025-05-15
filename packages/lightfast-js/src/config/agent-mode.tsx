import { InfinityIcon, MessageSquareIcon } from "lucide-react";

import type { AgentMode, AgentModeConfig } from "../types/agent-mode";

export const AGENT_MODE_CONFIG_MAPPING: Record<AgentMode, AgentModeConfig> = {
  agent: {
    title: "Agent",
    description: "Use the agent to interact with the system",
    icon: <InfinityIcon />,
  },
  manual: {
    title: "Manual",
    description: "Use the manual mode to interact with the system",
    icon: <MessageSquareIcon />,
  },
};
