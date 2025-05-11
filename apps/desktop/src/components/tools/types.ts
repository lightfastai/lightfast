export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: string;
  args?: any;
  result?: any;
  error?: string;
}

export interface ToolProps {
  toolInvocation: ToolInvocation;
  addToolResult: (params: { toolCallId: string; result: any }) => void;
  autoExecute?: boolean;
  readyToExecute?: boolean;
}
