import type { LucideIcon } from "lucide-react";

export interface SettingsNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export interface AccountInfo {
  name?: string;
  email?: string;
  createdAt?: Date;
  plan: string;
  organization?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: Date;
  lastUsed?: Date;
  permissions: string[];
  isActive: boolean;
}

export interface UsageStats {
  apiCalls: {
    current: number;
    limit: number;
  };
  activeAgents: {
    current: number;
    limit: number;
  };
  storage: {
    current: number;
    limit: number;
    unit: string;
  };
}

export interface BillingPlan {
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  isActive: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  passwordLastChanged?: Date;
  activeSessions: number;
  securityNotifications: {
    loginFromNewDevice: boolean;
    passwordChanges: boolean;
    apiKeyActivity: boolean;
  };
}