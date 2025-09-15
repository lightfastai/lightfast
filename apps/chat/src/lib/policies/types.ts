// Comprehensive user profile types
export type RateLimitConfig = {
  requests: number;
  window: "1m" | "1h" | "1d" | "1w";
  burst?: number;
  cooldown?: "5m" | "1h";
};

export type QuotaConfig = {
  tokensPerDay: number;
  tokensPerMonth: number;
  maxContextLength: number;
  maxResponseLength: number;
  concurrentRequests: number;
};

export type PermissionConfig = {
  canUploadFiles: boolean;
  canAccessPrivateModels: boolean;
  canCreateCustomTools: boolean;
  canShareConversations: boolean;
  canExportData: boolean;
  canUseApiKeys: boolean;
  maxFileSize: number; // MB
  allowedFileTypes: string[];
};

export type ModelAccessConfig = {
  allowedModels: string[];
  defaultModel: string;
  canSwitchModels: boolean;
  premiumModels: boolean;
};

export type FeatureFlags = {
  betaFeatures: boolean;
  experimentalTools: boolean;
  advancedSettings: boolean;
  customInstructions: boolean;
};

// Tool discriminated union (preserve existing tools)
export type Tool = 
  | { type: "webSearch"; enabled: boolean }
  | { type: "createDocument"; enabled: boolean };

export type ToolContext = Tool[];

// Core user profile (focused on essential functionality)
export type UserProfile = {
  tools: ToolContext;
  modelAccess: ModelAccessConfig;
  rateLimit: RateLimitConfig;
  quotas: QuotaConfig;
  permissions: PermissionConfig;
  features: FeatureFlags;
};

export type ToolPreferences = {
  webSearchEnabled: boolean;
  createDocumentEnabled?: boolean;
};

// Route context types
export type RouteContext = {
  sessionId: string;
  agentId: string;
  messageId: string;
  requestId: string;
};