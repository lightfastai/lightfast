import type { UserProfile, ToolPreferences, RouteContext } from "./types";

/**
 * CRITICAL: Each policy defines the COMPLETE user experience
 * This replaces ALL scattered conditional logic throughout the codebase
 */
export const userProfilePolicies = {
  /**
   * Anonymous users - Preserve current behavior exactly
   */
  anonymous: (
    auth: RouteContext & { type: "anonymous"; userId: string },
    prefs: ToolPreferences
  ): UserProfile => ({
    // Tools - exactly match current getActiveToolsForUser() logic
    tools: [
      { type: "webSearch", enabled: prefs.webSearchEnabled },
      { type: "createDocument", enabled: false }, // Current behavior: always disabled
    ],
    
    // Model access - exactly match current logic
    modelAccess: {
      allowedModels: ["*"], // Use getModelsForUser(false) logic
      defaultModel: "openai/gpt-5-nano", // Current default from getDefaultModelForUser(false)
      canSwitchModels: true, // Current behavior allows switching
      premiumModels: false,
    },
    
    // Rate limiting - exactly match current Arcjet config
    rateLimit: {
      requests: 10,      // Current: max: 10
      window: "1d",      // Current: interval: 86400 (24 hours)  
      burst: 10,         // Current: capacity: 10
      cooldown: "1h",    // New: reasonable cooldown
    },
    
    // Quotas - new functionality, start conservative
    quotas: {
      tokensPerDay: 10000,
      tokensPerMonth: 100000,
      maxContextLength: 16384,  // Conservative limit
      maxResponseLength: 4096,  // Conservative limit
      concurrentRequests: 1,    // Conservative limit
    },
    
    // Permissions - new functionality, minimal permissions
    permissions: {
      canUploadFiles: false,
      canAccessPrivateModels: false,
      canCreateCustomTools: false,
      canShareConversations: false,
      canExportData: false,
      canUseApiKeys: false,
      maxFileSize: 0,
      allowedFileTypes: [],
    },
    
    // Features - start minimal
    features: {
      betaFeatures: false,
      experimentalTools: false,
      advancedSettings: false,
      customInstructions: false,
    },
  }),

  /**
   * Authenticated users - Preserve current behavior + enhancements
   */
  auth_user: (
    auth: RouteContext & { 
      type: "auth_user"; 
      authenticatedUserId: string; 
      userId: string;
    },
    prefs: ToolPreferences
  ): UserProfile => ({
    // Tools - exactly match current getActiveToolsForUser() logic
    tools: [
      { type: "webSearch", enabled: prefs.webSearchEnabled },
      { type: "createDocument", enabled: prefs.createDocumentEnabled ?? true }, // Current: always enabled
    ],
    
    // Model access - match current authenticated user behavior
    modelAccess: {
      allowedModels: ["*"], // Use getModelsForUser(true) logic
      defaultModel: "openai/gpt-5-nano", // Current default
      canSwitchModels: true,
      premiumModels: false,
    },
    
    // Rate limiting - generous limits for auth users (no Arcjet needed)
    rateLimit: {
      requests: 1000,
      window: "1h",
      burst: 50,
    },
    
    // Better quotas for auth users
    quotas: {
      tokensPerDay: 100000,
      tokensPerMonth: 2000000,
      maxContextLength: 128000,
      maxResponseLength: 32768,
      concurrentRequests: 5,
    },
    
    // Standard permissions for auth users
    permissions: {
      canUploadFiles: true,
      canAccessPrivateModels: false,
      canCreateCustomTools: false,
      canShareConversations: true,
      canExportData: true,
      canUseApiKeys: false,
      maxFileSize: 50, // 50MB
      allowedFileTypes: ["pdf", "txt", "md", "docx", "csv"],
    },
    
    // More features for auth users
    features: {
      betaFeatures: false,
      experimentalTools: false,
      advancedSettings: true,
      customInstructions: true,
    },
  }),
} as const;

// Derived types from policies (single source of truth)
export type UserTier = keyof typeof userProfilePolicies;
export type AuthContext = Parameters<typeof userProfilePolicies[UserTier]>[0];