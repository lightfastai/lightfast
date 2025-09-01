import { createAgent } from "lightfast/agent";
import { gateway } from "@ai-sdk/gateway";

/**
 * Customer Support Agent - Specialized for customer service
 */
export const customerSupportAgent = createAgent({
  name: "customer-support",
  system: `You are a helpful customer support agent. 
Be polite, professional, and solution-oriented.
Always aim to resolve customer issues efficiently.
Escalate to human agents when necessary.
Provide clear next steps for resolution.
Follow up to ensure customer satisfaction.`,
  model: gateway("claude-3-5-sonnet-20241022"),
  // In a real implementation, you'd add tools like:
  // tools: { 
  //   searchKB: searchKnowledgeBaseTool,
  //   createTicket: ticketCreationTool,
  //   checkOrderStatus: orderStatusTool 
  // },
});