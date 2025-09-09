import { createAgent } from "lightfast/agent";
import { gateway } from "@ai-sdk/gateway";
import { createTool } from "lightfast/tool";
import { z } from "zod";

/**
 * Simple knowledge base search tool for customer support
 */
const searchKnowledgeBaseTool = createTool({
  description: "Search the customer support knowledge base for answers to common questions",
  inputSchema: z.object({
    query: z.string().describe("The search query to find relevant support articles"),
    category: z.enum(["billing", "technical", "account", "general"]).default("general").describe("Category to search within")
  }),
  execute: async ({ query, category }) => {
    // Simulated knowledge base search - in real implementation would query actual KB
    const mockResults = [
      { title: `${category.toUpperCase()}: ${query}`, content: `Here's helpful information about ${query} in the ${category} category.`, url: `/kb/${category}/${query.toLowerCase().replace(/\s+/g, '-')}` },
      { title: "Related Article", content: `Additional context about ${query}.`, url: `/kb/related` }
    ];
    
    return {
      results: mockResults,
      totalCount: mockResults.length,
      query,
      category
    };
  }
});

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
Follow up to ensure customer satisfaction.

You have access to a knowledge base search tool. Use it to find relevant information when customers ask questions.`,
  model: gateway("claude-3-5-sonnet-20241022"),
  tools: { 
    searchKB: searchKnowledgeBaseTool,
  },
});