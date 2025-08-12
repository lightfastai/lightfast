import DOMPurify from "isomorphic-dompurify";

/**
 * Input validation utilities for chat and form inputs
 */

// Constants for validation limits
export const INPUT_LIMITS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 4000,
  MAX_URL_COUNT: 10,
  MAX_CONSECUTIVE_NEWLINES: 3,
  MAX_CONSECUTIVE_SPACES: 10,
} as const;

// Regex patterns for validation
const PATTERNS = {
  // Basic XSS patterns to block
  SCRIPT_TAG: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  JAVASCRIPT_PROTOCOL: /javascript:/gi,
  DATA_PROTOCOL_SCRIPT: /data:.*script/gi,
  ON_EVENT_HANDLER: /on\w+\s*=/gi,
  
  // URL detection for limiting
  URL: /https?:\/\/[^\s]+/gi,
  
  // Excessive whitespace patterns
  EXCESSIVE_NEWLINES: /\n{4,}/g,
  EXCESSIVE_SPACES: / {11,}/g,
  
  // SQL injection patterns (basic)
  SQL_KEYWORDS: /(\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+.*\bSET\b)/gi,
  
  // Command injection patterns
  COMMAND_INJECTION: /[;&|`$()]/g,
} as const;

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive input validation and sanitization
 */
export function validateChatInput(input: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if input is empty or only whitespace
  if (!input || input.trim().length === 0) {
    errors.push("Message cannot be empty");
    return {
      isValid: false,
      sanitized: "",
      errors,
      warnings,
    };
  }
  
  // Check length limits
  if (input.length < INPUT_LIMITS.MIN_LENGTH) {
    errors.push(`Message must be at least ${INPUT_LIMITS.MIN_LENGTH} character`);
  }
  
  if (input.length > INPUT_LIMITS.MAX_LENGTH) {
    errors.push(`Message exceeds maximum length of ${INPUT_LIMITS.MAX_LENGTH} characters`);
  }
  
  // Check for potential XSS attempts
  if (PATTERNS.SCRIPT_TAG.test(input)) {
    warnings.push("Script tags detected and will be removed");
  }
  
  if (PATTERNS.JAVASCRIPT_PROTOCOL.test(input)) {
    warnings.push("JavaScript protocol detected and will be removed");
  }
  
  if (PATTERNS.ON_EVENT_HANDLER.test(input)) {
    warnings.push("Event handlers detected and will be removed");
  }
  
  // Check for SQL injection attempts (for logging/awareness)
  if (PATTERNS.SQL_KEYWORDS.test(input)) {
    warnings.push("SQL-like patterns detected");
  }
  
  // Check URL count
  const urlMatches = input.match(PATTERNS.URL);
  if (urlMatches && urlMatches.length > INPUT_LIMITS.MAX_URL_COUNT) {
    warnings.push(`Message contains ${urlMatches.length} URLs (max ${INPUT_LIMITS.MAX_URL_COUNT})`);
  }
  
  // Sanitize the input
  let sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed in chat
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  
  // Additional cleanup
  sanitized = sanitized
    // Remove excessive newlines
    .replace(PATTERNS.EXCESSIVE_NEWLINES, "\n\n\n")
    // Remove excessive spaces
    .replace(PATTERNS.EXCESSIVE_SPACES, " ".repeat(10))
    // Trim the result
    .trim();
  
  // Final length check after sanitization
  if (sanitized.length === 0) {
    errors.push("Message is empty after sanitization");
  }
  
  return {
    isValid: errors.length === 0 && sanitized.length > 0,
    sanitized,
    errors,
    warnings,
  };
}

/**
 * Quick validation for real-time feedback (less strict)
 */
export function quickValidateInput(input: string): {
  isValid: boolean;
  message?: string;
} {
  // Empty check
  if (!input || input.trim().length === 0) {
    return { isValid: false, message: "Message cannot be empty" };
  }
  
  // Length check
  if (input.length > INPUT_LIMITS.MAX_LENGTH) {
    return {
      isValid: false,
      message: `Message too long (${input.length}/${INPUT_LIMITS.MAX_LENGTH} characters)`,
    };
  }
  
  return { isValid: true };
}

/**
 * Sanitize input for display (when showing user messages)
 */
export function sanitizeForDisplay(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "code", "pre", "br"],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Check if input contains potentially malicious patterns
 */
export function detectMaliciousPatterns(input: string): {
  detected: boolean;
  patterns: string[];
} {
  const detectedPatterns: string[] = [];
  
  if (PATTERNS.SCRIPT_TAG.test(input)) {
    detectedPatterns.push("script_tag");
  }
  
  if (PATTERNS.JAVASCRIPT_PROTOCOL.test(input)) {
    detectedPatterns.push("javascript_protocol");
  }
  
  if (PATTERNS.DATA_PROTOCOL_SCRIPT.test(input)) {
    detectedPatterns.push("data_protocol_script");
  }
  
  if (PATTERNS.ON_EVENT_HANDLER.test(input)) {
    detectedPatterns.push("event_handler");
  }
  
  if (PATTERNS.SQL_KEYWORDS.test(input)) {
    detectedPatterns.push("sql_pattern");
  }
  
  if (PATTERNS.COMMAND_INJECTION.test(input)) {
    detectedPatterns.push("command_injection");
  }
  
  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
  };
}

/**
 * Format validation errors for user display
 */
export function formatValidationError(result: ValidationResult): string {
  if (result.isValid) {
    return "";
  }
  
  if (result.errors.length > 0) {
    return result.errors[0]; // Show first error
  }
  
  if (result.warnings.length > 0) {
    return result.warnings[0]; // Show first warning if no errors
  }
  
  return "Invalid input";
}