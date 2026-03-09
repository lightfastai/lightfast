import {
  createLoader,
  createSerializer,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

export const earlyAccessSearchParams = {
  // Form field values (preserved across validation errors)
  email: parseAsString.withDefault(""),
  companySize: parseAsString.withDefault(""),
  sources: parseAsString.withDefault(""), // comma-separated

  // Error states
  error: parseAsString, // general error message
  emailError: parseAsString, // email field validation error
  sourcesError: parseAsString, // sources field validation error
  companySizeError: parseAsString, // company size field validation error
  isRateLimit: parseAsBoolean.withDefault(false),

  // Success state
  success: parseAsBoolean.withDefault(false),
};

export const loadEarlyAccessSearchParams = createLoader(
  earlyAccessSearchParams
);

export const serializeEarlyAccessParams = createSerializer(
  earlyAccessSearchParams
);
