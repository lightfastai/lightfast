declare const __SDK_VERSION__: string;

export interface LightfastOptions {
  /** API base URL. Defaults to `https://lightfast.ai`. */
  baseUrl?: string;
}

/**
 * Lightfast SDK client (barebones).
 *
 * The full contract has been removed pending the post-v2 architecture.
 * The constructor still validates an API key; method registration
 * returns when concrete endpoints land.
 */
export class LightfastClient {
  readonly baseUrl: string;
  readonly version: string = __SDK_VERSION__;

  constructor(
    public readonly apiKey: string,
    options: LightfastOptions = {}
  ) {
    if (!apiKey?.startsWith("sk-lf-")) {
      throw new Error("Invalid Lightfast API key");
    }
    this.baseUrl = options.baseUrl ?? "https://lightfast.ai";
  }
}

/** Backwards-compatible factory matching the old createLightfast() shape. */
export function createLightfast(
  apiKey: string,
  options?: LightfastOptions
): LightfastClient {
  return new LightfastClient(apiKey, options);
}

/** SDK version, injected at build time. */
export const VERSION: string = __SDK_VERSION__;
