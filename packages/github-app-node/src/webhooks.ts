import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubWebhookSignature(input: {
  body: string;
  secret: string;
  signature256: string | null | undefined;
}): boolean {
  const signature = input.signature256 ?? "";
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", input.secret)
    .update(input.body)
    .digest("hex");
  const actual = signature.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
