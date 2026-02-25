import { env } from "../env";

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

  const key = await importPrivateKey(env.GITHUB_PRIVATE_KEY);
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
  const timeout = setTimeout(() => controller.abort(), 10_000);

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
 * Import a base64-encoded PKCS#8 PEM private key via Web Crypto.
 */
async function importPrivateKey(base64Pem: string): Promise<CryptoKey> {
  // Decode base64 → PEM string
  const pem = atob(base64Pem);

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
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
