import { searchLogic as searchLogicCore } from "@repo/console-search";
import type { SearchLogicInput, SearchLogicOutput } from "@repo/console-search";
import type { V1AuthContext } from "@repo/console-search";
import { recordSystemActivity } from "@api/console/lib/activity";
import type { ActivityData } from "@api/console/lib/activity";

export type { SearchLogicInput, SearchLogicOutput };

export async function searchLogic(
  auth: V1AuthContext,
  input: SearchLogicInput,
): Promise<SearchLogicOutput> {
  return searchLogicCore(auth, input, {
    onActivity: (params) => recordSystemActivity(params as ActivityData),
  });
}
