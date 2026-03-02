import { Receiver as UpstashReceiver } from "@upstash/qstash";
import { qstashEnv } from "../env";

export interface VerifyOptions {
  signature: string;
  body: string;
  clockTolerance?: number;
}

/**
 * QStash request receiver/verifier
 *
 * Verifies that incoming requests are authentically from QStash
 * by validating the HMAC-SHA256 signature.
 */
export class Receiver {
  private receiver: UpstashReceiver;

  constructor(options?: {
    currentSigningKey?: string;
    nextSigningKey?: string;
  }) {
    this.receiver = new UpstashReceiver({
      currentSigningKey:
        options?.currentSigningKey ?? qstashEnv.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey:
        options?.nextSigningKey ?? qstashEnv.QSTASH_NEXT_SIGNING_KEY,
    });
  }

  /**
   * Verify a QStash request signature
   *
   * @returns true if the signature is valid
   * @throws if the signature is invalid
   */
  async verify(options: VerifyOptions): Promise<boolean> {
    return this.receiver.verify({
      signature: options.signature,
      body: options.body,
      clockTolerance: options.clockTolerance,
    });
  }
}
