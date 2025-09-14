import { userProfilePolicies, type AuthContext } from "./definitions";
import type { UserProfile, ToolContext, Tool, ToolPreferences, PermissionConfig } from "./types";

export const ProfileUtils = {
  /**
   * Create complete user profile from auth context
   * REPLACES: getActiveToolsForUser, createSystemPromptForUser, rate limit checks
   */
  fromAuthContext: (auth: AuthContext, prefs: ToolPreferences): UserProfile => {
    const policy = userProfilePolicies[auth.type];
    return policy(auth as any, prefs);
  },

  // Tool utilities (replace scattered tool logic)
  getEnabledTools: (tools: ToolContext): Tool["type"][] => {
    return tools.filter(tool => tool.enabled).map(tool => tool.type);
  },

  isToolEnabled: (tools: ToolContext, toolType: Tool["type"]): boolean => {
    const tool = tools.find(t => t.type === toolType);
    return tool?.enabled ?? false;
  },

  // Permission checking
  hasPermission: (profile: UserProfile, permission: keyof PermissionConfig): boolean => {
    return profile.permissions[permission] as boolean;
  },

  // Model access checking  
  canUseModel: (profile: UserProfile, modelId: string): boolean => {
    return profile.modelAccess.allowedModels.includes("*") || 
           profile.modelAccess.allowedModels.includes(modelId);
  },

  // Quota checking
  exceedsQuota: (profile: UserProfile, tokensUsed: number, period: "day" | "month"): boolean => {
    const limit = period === "day" ? profile.quotas.tokensPerDay : profile.quotas.tokensPerMonth;
    return tokensUsed >= limit;
  },

  // System prompt generation (REPLACES createSystemPromptForUser)
  createSystemPrompt: (profile: UserProfile): string => {
    const hasWebSearch = ProfileUtils.isToolEnabled(profile.tools, "webSearch");
    const hasCreateDocument = ProfileUtils.isToolEnabled(profile.tools, "createDocument");
    
    if (hasCreateDocument && hasWebSearch) {
      return `You are a helpful AI assistant with document creation and web search capabilities.
      
IMPORTANT: When users request code generation, examples, substantial code snippets, or diagrams, ALWAYS use the createDocument tool. Do NOT include the code or diagram syntax in your text response - they should ONLY exist in the document artifact.

Use createDocument for:
- Code examples, functions, components  
- Working implementations and prototypes
- Scripts, configuration files
- Flowcharts and diagrams
- Any visual representation

CITATION USAGE:
When referencing external information, use numbered citations in your response and provide structured citation data.
Format: Use [1], [2], [3] etc. in your text, then end your complete response with citation data.`;
    } else if (hasWebSearch) {
      return `You are a helpful AI assistant with web search capabilities.

IMPORTANT: You do not have the ability to create code artifacts, diagrams, or documents. Focus on providing helpful text-based responses and using web search when additional information is needed.

CODE FORMATTING:
When providing code snippets in your responses, always use proper markdown code blocks with language specification.

CITATION USAGE:
When referencing external information, use numbered citations in your response and provide structured citation data.`;
    } else if (hasCreateDocument) {
      return `You are a helpful AI assistant with document creation capabilities.
      
IMPORTANT: When users request code generation, examples, substantial code snippets, or diagrams, ALWAYS use the createDocument tool.`;
    } else {
      return "You are a helpful AI assistant.";
    }
  },

  // Create Arcjet configuration from policy (simple, tightly-coupled)
  createArcjetConfig: (profile: UserProfile): any => {
    const { requests, window, burst } = profile.rateLimit;
    
    const windowMap = { "1m": 60, "1h": 3600, "1d": 86400, "1w": 604800 };
    const intervalSeconds = windowMap[window];
    
    const rules = [];
    
    // Add sliding window rule
    rules.push({
      type: "slidingWindow",
      mode: process.env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
      max: requests,
      interval: intervalSeconds,
    });
    
    // Add token bucket if burst specified
    if (burst) {
      rules.push({
        type: "tokenBucket", 
        mode: process.env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
        refillRate: Math.floor(requests / (intervalSeconds / 60)), // per minute
        interval: 60,
        capacity: burst,
      });
    }
    
    return {
      characteristics: ["ip.src"],
      rules,
    };
  },
};