import "server-only";

import type {
  V2ApisListKeysRequestBody,
  V2ApisListKeysResponseBody,
  V2IdentitiesCreateIdentityRequestBody,
  V2IdentitiesCreateIdentityResponseBody,
  V2KeysCreateKeyRequestBody,
  V2KeysCreateKeyResponseBody,
  V2KeysDeleteKeyRequestBody,
  V2KeysDeleteKeyResponseBody,
  V2KeysGetKeyRequestBody,
  V2KeysGetKeyResponseBody,
  V2KeysRerollKeyRequestBody,
  V2KeysRerollKeyResponseBody,
  V2KeysUpdateKeyRequestBody,
  V2KeysUpdateKeyResponseBody,
  V2KeysVerifyKeyRequestBody,
  V2KeysVerifyKeyResponseBody,
} from "@unkey/api/models/components";

import { unkeyEnv } from "./env";

const UNKEY_API_ORIGIN = "https://api.unkey.com";
const UNKEY_ALLOWED_HOSTS = new Set(["api.unkey.com"]);
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

let client: UnkeyClient | undefined;

export class UnkeyApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly responseBody: unknown
  ) {
    super(message);
    this.name = "UnkeyApiError";
  }
}

export interface UnkeyClient {
  apis: {
    listKeys(
      input: V2ApisListKeysRequestBody
    ): Promise<V2ApisListKeysResponseBody>;
  };
  identities: {
    createIdentity(
      input: V2IdentitiesCreateIdentityRequestBody
    ): Promise<V2IdentitiesCreateIdentityResponseBody>;
  };
  keys: {
    createKey(
      input: V2KeysCreateKeyRequestBody
    ): Promise<V2KeysCreateKeyResponseBody>;
    deleteKey(
      input: V2KeysDeleteKeyRequestBody
    ): Promise<V2KeysDeleteKeyResponseBody>;
    getKey(input: V2KeysGetKeyRequestBody): Promise<V2KeysGetKeyResponseBody>;
    rerollKey(
      input: V2KeysRerollKeyRequestBody
    ): Promise<V2KeysRerollKeyResponseBody>;
    updateKey(
      input: V2KeysUpdateKeyRequestBody
    ): Promise<V2KeysUpdateKeyResponseBody>;
    verifyKey(
      input: V2KeysVerifyKeyRequestBody
    ): Promise<V2KeysVerifyKeyResponseBody>;
  };
}

function assertUnkeyUrl(url: URL) {
  if (url.protocol !== "https:" || !UNKEY_ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`[unkey] Unexpected API host: ${url.origin}`);
  }
}

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

class LightfastUnkeyClient implements UnkeyClient {
  constructor(private readonly rootKey: string) {}

  apis = {
    listKeys: (input: V2ApisListKeysRequestBody) =>
      this.request<V2ApisListKeysResponseBody>("/v2/apis.listKeys", input),
  };

  identities = {
    createIdentity: (input: V2IdentitiesCreateIdentityRequestBody) =>
      this.request<V2IdentitiesCreateIdentityResponseBody>(
        "/v2/identities.createIdentity",
        input
      ),
  };

  keys = {
    createKey: (input: V2KeysCreateKeyRequestBody) =>
      this.request<V2KeysCreateKeyResponseBody>("/v2/keys.createKey", input),
    deleteKey: (input: V2KeysDeleteKeyRequestBody) =>
      this.request<V2KeysDeleteKeyResponseBody>("/v2/keys.deleteKey", input),
    getKey: (input: V2KeysGetKeyRequestBody) =>
      this.request<V2KeysGetKeyResponseBody>("/v2/keys.getKey", input),
    rerollKey: (input: V2KeysRerollKeyRequestBody) =>
      this.request<V2KeysRerollKeyResponseBody>("/v2/keys.rerollKey", input),
    updateKey: (input: V2KeysUpdateKeyRequestBody) =>
      this.request<V2KeysUpdateKeyResponseBody>("/v2/keys.updateKey", input),
    verifyKey: (input: V2KeysVerifyKeyRequestBody) =>
      this.request<V2KeysVerifyKeyResponseBody>("/v2/keys.verifyKey", input),
  };

  private async request<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(path, UNKEY_API_ORIGIN);
    assertUnkeyUrl(url);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.rootKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      redirect: "manual",
    });
    const payload = await responseBody(response);

    if (REDIRECT_STATUS_CODES.has(response.status)) {
      const location = response.headers.get("location");
      if (location) {
        try {
          assertUnkeyUrl(new URL(location, url));
        } catch (error) {
          throw new UnkeyApiError(
            response.status,
            error instanceof Error
              ? error.message
              : "Unkey API redirected to an unexpected host",
            payload
          );
        }
      }
      throw new UnkeyApiError(response.status, "Unkey API redirected", payload);
    }

    if (!response.ok) {
      throw new UnkeyApiError(
        response.status,
        `Unkey API request failed with ${response.status}`,
        payload
      );
    }

    return payload as T;
  }
}

export function createUnkeyClient(rootKey = unkeyEnv.UNKEY_ROOT_KEY) {
  return new LightfastUnkeyClient(rootKey);
}

export function getUnkeyClient() {
  client ??= createUnkeyClient();
  return client;
}

export { unkeyEnv };
