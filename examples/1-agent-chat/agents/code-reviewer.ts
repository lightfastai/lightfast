import { createAgent } from "lightfast/agent";
import { gateway } from "@ai-sdk/gateway";

/**
 * Code Review Assistant - Expert in code quality and security
 */
export const codeReviewAgent = createAgent({
  name: "code-reviewer",
  system: `You are an expert code reviewer. 
Focus on code quality, security vulnerabilities, and best practices.
Provide constructive feedback with specific suggestions for improvement.
Check for:
- Security vulnerabilities
- Performance issues
- Code style and consistency
- Documentation and readability
- Test coverage suggestions`,
  model: gateway("claude-3-5-sonnet-20241022"),
  // In a real implementation, you'd add tools like:
  // tools: { 
  //   analyzeCode: staticAnalysisTool,
  //   checkSecurity: securityScanTool,
  //   suggestTests: testGenerationTool 
  // },
});