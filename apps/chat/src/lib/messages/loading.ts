// Character budgets used for historical message pagination.
// Update these values to tune how much history we hydrate by default:
// - MESSAGE_INITIAL_CHAR_BUDGET: chars fetched for the first page load.
// - MESSAGE_BACKGROUND_CHAR_BUDGET: total chars the background loader will hydrate.
// - MESSAGE_HISTORY_HARD_CAP: global ceiling before prompting the user to opt-in.
export const MESSAGE_INITIAL_CHAR_BUDGET = 20_000;
export const MESSAGE_BACKGROUND_CHAR_BUDGET = 200_000;
export const MESSAGE_HISTORY_HARD_CAP = 500_000;
export const MESSAGE_FALLBACK_PAGE_SIZE = 40;

export const MESSAGE_PAGE_STALE_TIME = 30 * 1000; // 30 seconds

export const MESSAGE_PAGE_GC_TIME = 30 * 60 * 1000; // 30 minutes

export type MessageHistoryFetchState =
  | "idle"
  | "prefetching"
  | "saturated"
  | "capped"
  | "complete";

export interface MessageHistoryMeta {
  state: MessageHistoryFetchState;
  totalChars: number;
  backgroundBudget: number;
  hardCap: number;
  backgroundBudgetReached: boolean;
  hardCapReached: boolean;
  overrideEnabled: boolean;
  hasNextPage: boolean;
  oversizedMessageIds: string[];
}
