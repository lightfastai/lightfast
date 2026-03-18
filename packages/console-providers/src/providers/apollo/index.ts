import { defineApiProvider } from "../../define";
import { PROVIDER_DISPLAY } from "../../display";
import { apolloApi } from "./api";
import type { ApolloAccountInfo, ApolloConfig } from "./auth";
import {
  apolloAccountInfoSchema,
  apolloConfigSchema,
  apolloProviderConfigSchema,
} from "./auth";

export const apollo = defineApiProvider({
  ...PROVIDER_DISPLAY.apollo,
  optional: true,
  envSchema: {}, // No server-side secrets — API key is stored per-installation in token vault
  createConfig: (_env): ApolloConfig => ({}),
  configSchema: apolloConfigSchema,
  accountInfoSchema: apolloAccountInfoSchema,
  providerConfigSchema: apolloProviderConfigSchema,

  // Apollo is a proxy-only provider — no data events or sync categories
  categories: {},
  events: {},
  defaultSyncEvents: [],

  buildProviderConfig: () => ({
    provider: "apollo" as const,
    type: "workspace" as const,
  }),

  resolveCategory: (et) => et,
  getBaseEventType: (st) => st,
  deriveObservationType: (st) => st,

  auth: {
    kind: "api-key" as const,
    buildAuthHeader: (apiKey) => `Api-Key ${apiKey}`,
    getActiveToken: (
      _config: ApolloConfig,
      _externalId: string,
      storedApiKey: string | null
    ) => {
      if (!storedApiKey) {
        return Promise.reject(new Error("apollo: no api key stored"));
      }
      return Promise.resolve(storedApiKey);
    },
    usesStoredToken: true as const,
    processSetup: async (
      _config: ApolloConfig,
      { apiKey }: { apiKey: string }
    ) => {
      const now = new Date().toISOString();
      return {
        status: "connected" as const,
        externalId: "api-key",
        accountInfo: {
          version: 1 as const,
          sourceType: "apollo" as const,
          events: [] as string[],
          installedAt: now,
          lastValidatedAt: now,
          raw: {},
        } satisfies ApolloAccountInfo,
        tokens: { accessToken: apiKey, raw: {} },
      };
    },
  },

  api: apolloApi,

  resourcePicker: {
    installationMode: "single",
    resourceLabel: "workspace",
    enrichInstallation: async (_executeApi, inst) => ({
      id: inst.id,
      externalId: inst.externalId,
      label: "Apollo Workspace",
    }),
    listResources: async () => [
      { id: "workspace", name: "Apollo Workspace", subtitle: null },
    ],
  },

  edgeRules: [],
});
