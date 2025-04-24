// vendor/security/src/request-id.ts
import { secureApiRequestEnv } from "../../env";

const CURRENT_VERSION = "v1";
const RANDOM_BYTES = 16; // 128 bits of entropy

interface ParsedRequestId {
  version: string;
  timestamp: number;
  random: string;
  context: string;
  signature: string;
}

export interface RequestContext {
  method: string;
  path: string;
  userAgent?: string;
}

export class SecureRequestId {
  private static SECRET = secureApiRequestEnv.REQUEST_ID_SECRET;
  public static MAX_AGE = 5 * 60 * 1000; // 5 minutes
  private static encoder = new TextEncoder();

  private static async generateHmac(message: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      this.encoder.encode(this.SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      this.encoder.encode(message),
    );

    // Convert to base64url
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  private static async generateSignature(
    version: string,
    timestamp: number,
    random: string,
    context: string,
  ): Promise<string> {
    return this.generateHmac(`${version}.${timestamp}.${random}.${context}`);
  }

  private static async generateContextHash(
    context: RequestContext,
  ): Promise<string> {
    return this.generateHmac(JSON.stringify(context));
  }

  private static parseRequestId(requestId: string): ParsedRequestId | null {
    try {
      const parts = requestId.split(".");
      if (parts.length !== 5) return null;

      const [version, timestampStr, random, context, signature] = parts;

      // Validate all parts exist
      if (!version || !timestampStr || !random || !context || !signature) {
        return null;
      }

      // Validate version
      if (version !== CURRENT_VERSION) return null;

      // Validate timestamp
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) return null;

      // Validate random (base64url format)
      if (!/^[A-Za-z0-9_-]{22}$/.test(random)) return null;

      // Validate context is not empty
      if (!context) return null;

      return { version, timestamp, random, context, signature };
    } catch {
      return null;
    }
  }

  /**
   * Parse a request ID string into its components
   * This is useful to check if a request ID has valid structure
   * before performing full validation
   */
  public static parse(requestId: string): ParsedRequestId | null {
    return this.parseRequestId(requestId);
  }

  /**
   * Verify only the signature of a request ID without checking expiration
   * This is useful for refreshing expired request IDs
   */
  public static async verifySignature(
    requestId: string,
    context: RequestContext,
  ): Promise<boolean> {
    const parsed = this.parseRequestId(requestId);
    if (!parsed) return false;

    const {
      version,
      timestamp,
      random,
      context: storedContext,
      signature,
    } = parsed;

    // Verify context matches current request
    const expectedContext = await this.generateContextHash(context);
    if (storedContext !== expectedContext) {
      return false;
    }

    // Verify signature
    const expectedSignature = await this.generateSignature(
      version,
      timestamp,
      random,
      storedContext,
    );

    return signature === expectedSignature;
  }

  static async generate(context: RequestContext): Promise<string> {
    const version = CURRENT_VERSION;
    const timestamp = Date.now();

    // Generate random bytes using Web Crypto API
    const randomBuffer = new Uint8Array(RANDOM_BYTES);
    crypto.getRandomValues(randomBuffer);
    const random = btoa(String.fromCharCode(...randomBuffer))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const contextHash = await this.generateContextHash(context);
    const signature = await this.generateSignature(
      version,
      timestamp,
      random,
      contextHash,
    );

    return `${version}.${timestamp}.${random}.${contextHash}.${signature}`;
  }

  static async verify(
    requestId: string,
    context: RequestContext,
  ): Promise<boolean> {
    const parsed = this.parseRequestId(requestId);
    if (!parsed) return false;

    const {
      version,
      timestamp,
      random,
      context: storedContext,
      signature,
    } = parsed;

    // Verify timestamp is not too old
    if (Date.now() - timestamp > this.MAX_AGE) {
      return false;
    }

    // Verify context matches current request
    const expectedContext = await this.generateContextHash(context);
    if (storedContext !== expectedContext) {
      return false;
    }

    // Verify signature
    const expectedSignature = await this.generateSignature(
      version,
      timestamp,
      random,
      storedContext,
    );

    return signature === expectedSignature;
  }

  static extractTimestamp(requestId: string): number | null {
    const parsed = this.parseRequestId(requestId);
    return parsed ? parsed.timestamp : null;
  }
}
