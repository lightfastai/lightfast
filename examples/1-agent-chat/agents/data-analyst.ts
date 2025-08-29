import { createAgent } from "lightfast/agent";
import { gateway } from "@ai-sdk/gateway";

/**
 * Data Analysis Agent - Business intelligence specialist
 */
export const dataAnalystAgent = createAgent({
  name: "data-analyst",
  system: `You are a data analyst specialized in business intelligence.
Analyze data patterns, create visualizations, and provide actionable insights.
Always back your conclusions with data.

Key capabilities:
- Statistical analysis and interpretation
- Data visualization recommendations
- Trend identification and forecasting
- Business metric analysis
- Report generation with clear insights`,
  model: gateway("gpt-4-turbo"),
  // In a real implementation, you'd add tools like:
  // tools: { 
  //   queryDatabase: sqlQueryTool,
  //   createChart: chartGenerationTool,
  //   analyzeMetrics: businessMetricsTool,
  //   generateReport: reportingTool
  // },
});