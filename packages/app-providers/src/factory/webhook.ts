import type { z } from "zod";
import type { ProviderApi } from "../provider/api";
import type { AuthDef } from "../provider/auth";
import type { EventDefinition } from "../provider/events";
import type { CategoryDef, providerKindSchema } from "../provider/kinds";
import type { BaseProviderAccountInfo } from "../provider/primitives";
import type { WebhookProvider } from "../provider/shape";
import { buildEnvGetter } from "../runtime/env";

/**
 * Create a type-safe webhook + OAuth provider definition.
 * Injects `kind: "webhook"` and the lazy `env` getter automatically.
 *
 * Do NOT pass explicit type arguments — let TypeScript infer all generics
 * to preserve the narrow literal types for categories and events.
 */
export function defineWebhookProvider<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
  TAuth extends AuthDef<TConfig, TAccountInfo> = AuthDef<TConfig, TAccountInfo>,
  const TCategories extends Record<string, CategoryDef> = Record<
    string,
    CategoryDef
  >,
  const TEvents extends Record<string, EventDefinition> = Record<
    string,
    EventDefinition
  >,
  TAccountInfoSchema extends z.ZodObject = z.ZodObject,
  TProviderConfigSchema extends z.ZodObject = z.ZodObject,
  const TApi extends ProviderApi = ProviderApi,
>(
  def: Omit<
    WebhookProvider<
      TConfig,
      TAccountInfo,
      TAuth,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema,
      TApi
    >,
    "env" | "kind"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): WebhookProvider<
  TConfig,
  TAccountInfo,
  TAuth,
  TCategories,
  TEvents,
  TAccountInfoSchema,
  TProviderConfigSchema,
  TApi
> {
  let _env: Record<string, string> | undefined;
  const result = {
    ...def,
    kind: "webhook" as const satisfies z.infer<typeof providerKindSchema>,
    get env(): Record<string, string> {
      _env ??= buildEnvGetter(def.envSchema);
      return _env;
    },
  };
  return Object.freeze(result) as WebhookProvider<
    TConfig,
    TAccountInfo,
    TAuth,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema,
    TApi
  >;
}
