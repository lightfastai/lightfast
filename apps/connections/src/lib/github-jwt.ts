import type { GitHubInstallationRaw } from "@repo/gateway-types";
import { env } from "../env.js";

export type { GitHubInstallationRaw as GitHubInstallationDetails };

/**
 * Create a GitHub App JWT for authenticating as the App.
 * Uses Web Crypto RSASSA-PKCS1-v1_5 (RS256) — edge-compatible.
 *
 * The JWT is used to request short-lived installation access tokens
 * via POST /app/installations/{id}/access_tokens.
 */
export async function createGitHubAppJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60, // 60s clock skew tolerance
    exp: now + 600, // 10 minute max
    iss: env.GITHUB_APP_ID,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(env.GITHUB_APP_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = base64UrlEncodeBytes(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

/**
 * Request a short-lived installation access token from GitHub.
 * Token expires in 1 hour. Never stored — generated on demand.
 */
export async function getInstallationToken(
  installationId: string,
): Promise<string> {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Invalid GitHub installation ID: must be numeric");
  }

  const jwt = await createGitHubAppJWT();

  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, 10_000);

  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "lightfast-connections",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `GitHub installation token request failed: ${response.status}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (typeof data.token !== "string" || data.token.length === 0) {
    throw new Error("GitHub installation token response missing valid token");
  }
  return data.token;
}

/**
 * Fetch a GitHub App installation by ID using the App-level JWT.
 * Returns account info, permissions, and subscribed webhook events.
 */
export async function getInstallationDetails(
  installationId: string,
): Promise<GitHubInstallationRaw> {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Invalid GitHub installation ID: must be numeric");
  }

  const jwt = await createGitHubAppJWT();

  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, 10_000);

  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "lightfast-connections",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `GitHub installation details fetch failed: ${response.status}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const account = data.account as Record<string, unknown> | null;

  if (!account || typeof account.login !== "string") {
    throw new Error("GitHub installation response missing account data");
  }

  return {
    account: {
      login: account.login,
      id: account.id as number,
      type: account.type === "User" ? "User" : "Organization",
      avatar_url: (account.avatar_url as string | undefined) ?? "",
    },
    permissions: (data.permissions as Record<string, string> | undefined) ?? {},
    events: (data.events as string[] | undefined) ?? [],
    created_at: (data.created_at as string | undefined) ?? new Date().toISOString(),
  };
}

/**
 * Import a PKCS#8 PEM private key via Web Crypto.
 *
 * Handles common env var formats:
 *  - Raw PEM with literal `\n` characters (Vercel convention)
 *  - Raw PEM with actual newlines
 *  - Quoted PEM strings
 *  - Base64-encoded PEM (legacy: entire PEM wrapped in one more base64 layer)
 */
async function importPrivateKey(rawKey: string): Promise<CryptoKey> {
  // Normalize: strip quotes, replace literal \n with actual newlines
  let pem = rawKey
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  // If it doesn't look like PEM, try base64-decoding (legacy format)
  if (!pem.includes("-----BEGIN")) {
    try {
      pem = atob(pem);
    } catch {
      throw new Error(
        "GITHUB_APP_PRIVATE_KEY is not a valid PEM key or base64-encoded PEM",
      );
    }
  }

  // GitHub issues PKCS#1 keys (BEGIN RSA PRIVATE KEY) but Web Crypto
  // only supports PKCS#8 (BEGIN PRIVATE KEY). Detect and reject early.
  if (pem.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    throw new Error(
      "GITHUB_APP_PRIVATE_KEY is in PKCS#1 format (RSA PRIVATE KEY). " +
        "Web Crypto requires PKCS#8. Convert with: " +
        "openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem",
    );
  }

  // Strip PEM headers and decode inner base64
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = atob(pemContents);
  const keyBytes = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    keyBytes[i] = binaryDer.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
