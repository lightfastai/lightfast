"use client";

import { memo } from "react";

const AgentList = memo(function AgentList() {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">
        No agents created yet. Get started by creating your first agent.
      </p>
    </div>
  );
});

export { AgentList };