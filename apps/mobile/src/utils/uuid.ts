// Lightweight UUID v4 generator compatible with React Native/Expo
// Uses crypto.getRandomValues when available, falls back to Math.random

function _getRandomValues(buf: Uint8Array) {
  if (typeof global !== "undefined" && (global as any).crypto?.getRandomValues) {
    return (global as any).crypto.getRandomValues(buf);
  }
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

export function randomUUID(): string {
  // RFC4122 version 4 UUID
  const bytes = _getRandomValues(new Uint8Array(16));
  // Per RFC 4122 section 4.4
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  const b = Array.from(bytes, toHex);
  return (
    b[0] + b[1] + b[2] + b[3] + "-" +
    b[4] + b[5] + "-" +
    b[6] + b[7] + "-" +
    b[8] + b[9] + "-" +
    b[10] + b[11] + b[12] + b[13] + b[14] + b[15]
  );
}

