/**
 * Web Crypto API Utilities for API Key Management
 * 
 * Uses Web Crypto API for maximum performance and Edge Runtime compatibility.
 * Perfect for high-entropy API keys (190+ bits entropy from nanoid).
 * 
 * Performance: 10x faster than Argon2 with equivalent security for API keys.
 */

/**
 * Hash an API key using SHA-256 via Web Crypto API
 * 
 * For API keys with 190+ bits of entropy, SHA-256 provides perfect security:
 * - Preimage resistance: 2^256 computational complexity
 * - Collision resistance: 2^128 computational complexity  
 * - No rainbow table attacks possible (2^256 storage impossible)
 * 
 * Edge Runtime compatible - uses Web Crypto API only.
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify an API key against its stored hash
 * 
 * Uses constant-time string comparison to prevent timing attacks.
 * Though with 190-bit entropy, timing attacks are already impractical.
 */
export async function verifyApiKey(apiKey: string, storedHash: string): Promise<boolean> {
  const computedHash = await hashApiKey(apiKey);
  
  // Constant-time comparison (though unnecessary for 190-bit entropy)
  if (computedHash.length !== storedHash.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Generate a fast lookup hash for API key validation
 * Uses SHA-256 for deterministic, fast lookups without timing vulnerabilities
 * 
 * This is the same function as before but now using Web Crypto API
 * for full Edge Runtime compatibility.
 */
export async function generateKeyLookup(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

