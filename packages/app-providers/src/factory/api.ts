import type { z } from "zod";
import type { ProviderApi } from "../provider/api";
import type { EventDefinition } from "../provider/events";
import type { CategoryDef, providerKindSchema } from "../provider/kinds";
import type { BaseProviderAccountInfo } from "../provider/primitives";
import type { ApiProvider } from "../provider/shape";
import { buildEnvGetter } from "../runtime/env";

/**
 * Create a type-safe API-only provider definition.
 * Injects `kind: "api"` and the lazy `env` getter automatically.
 */
export function defineApiProvider<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
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
    ApiProvider<
      TConfig,
      TAccountInfo,
      TCategories,
      TEvents,
      TAccountInfoSchema,
      TProviderConfigSchema,
      TApi
    >,
    "env" | "kind"
  > & { readonly defaultSyncEvents: readonly (keyof TCategories & string)[] }
): ApiProvider<
  TConfig,
  TAccountInfo,
  TCategories,
  TEvents,
  TAccountInfoSchema,
  TProviderConfigSchema,
  TApi
> {
  let _env: Record<string, string> | undefined;
  const result = {
    ...def,
    kind: "api" as const satisfies z.infer<typeof providerKindSchema>,
    get env(): Record<string, string> {
      _env ??= buildEnvGetter(def.envSchema);
      return _env;
    },
  };
  return Object.freeze(result) as ApiProvider<
    TConfig,
    TAccountInfo,
    TCategories,
    TEvents,
    TAccountInfoSchema,
    TProviderConfigSchema,
    TApi
  >;
}
