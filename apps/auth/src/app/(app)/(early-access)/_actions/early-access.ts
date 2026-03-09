"use server";

import { captureException } from "@sentry/nextjs";
import {
  ARCJET_KEY,
  arcjet,
  detectBot,
  fixedWindow,
  request,
  shield,
  slidingWindow,
  validateEmail,
} from "@vendor/security";
import { redis } from "@vendor/upstash";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { handleClerkError } from "../_lib/clerk-error-handler";

const earlyAccessSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  companySize: z.string().min(1, "Company size is required"),
  sources: z.array(z.string()).min(1, "Please select at least one data source"),
});

const EARLY_ACCESS_EMAILS_SET_KEY = "early-access:emails";

function buildEarlyAccessUrl(
  params: Record<string, string | boolean | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false) {
      searchParams.set(key, String(value));
    }
  }
  return `/early-access?${searchParams.toString()}`;
}

// Configure Arcjet protection for early access signup
const aj = arcjet({
  key: ARCJET_KEY,
  // Use IP for rate limiting characteristics
  characteristics: ["ip.src"],
  rules: [
    // Validate email quality - block disposable/temporary emails
    validateEmail({
      mode: "LIVE",
      // Block disposable email services, invalid formats, and domains without MX records
      deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
    }),
    // Shield protects against common attacks like SQL injection, XSS
    // Start in DRY_RUN mode to monitor before blocking
    shield({
      mode: env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN",
    }),
    // Block automated bots from spamming the early access
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Allow search engines for SEO
        "CATEGORY:MONITOR", // Allow monitoring services
      ],
    }),
    // Hourly limit: Sliding window prevents burst at window boundaries
    slidingWindow({
      mode: "LIVE",
      interval: "1h",
      max: 10, // Allow up to 10 signups per hour from same IP (offices, families)
    }),
    // Daily limit: Sliding window for consistent daily protection
    slidingWindow({
      mode: "LIVE",
      interval: "24h",
      max: 50, // Maximum 50 signups per day from same IP
    }),
    // Burst protection: Fixed window is fine for short bursts
    fixedWindow({
      mode: "LIVE",
      window: "10s",
      max: 3, // Max 3 attempts in 10 seconds (allows for quick corrections)
    }),
  ],
});

export async function joinEarlyAccessAction(
  formData: FormData
): Promise<never> {
  try {
    // Parse raw form values for preserving across redirects
    const rawEmail = (formData.get("email") as string | null) ?? "";
    const rawCompanySize = (formData.get("companySize") as string | null) ?? "";
    const rawSources = (formData.get("sources") as string | null) ?? "";

    // Validate form data
    const validatedFields = earlyAccessSchema.safeParse({
      email: rawEmail,
      companySize: rawCompanySize,
      sources: rawSources.split(",").filter(Boolean),
    });

    // Redirect with field errors if validation fails
    if (!validatedFields.success) {
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      redirect(
        buildEarlyAccessUrl({
          email: rawEmail,
          companySize: rawCompanySize,
          sources: rawSources,
          emailError: fieldErrors.email?.[0],
          companySizeError: fieldErrors.companySize?.[0],
          sourcesError: fieldErrors.sources?.[0],
        })
      );
    }

    // Fields have been validated
    const { email, companySize, sources } = validatedFields.data;
    const sourcesStr = sources.join(",");

    // Check Arcjet protection with the validated email
    const req = await request();
    const decision = await aj.protect(req, {
      // Pass email for validateEmail rule
      email,
    });

    // Handle denied requests from Arcjet
    if (decision.isDenied()) {
      const reason = decision.reason;

      if (reason.isRateLimit()) {
        redirect(
          buildEarlyAccessUrl({
            error: "Too many signup attempts. Please try again later.",
            isRateLimit: true,
            email,
            companySize,
            sources: sourcesStr,
          })
        );
      }

      let errorMessage =
        "Your request could not be processed. Please try again.";
      if (reason.isBot()) {
        errorMessage =
          "Automated signup detected. Please complete the form manually.";
      } else if (reason.isShield()) {
        errorMessage =
          "Request blocked for security reasons. Please try again.";
      } else if (
        "isEmail" in reason &&
        typeof reason.isEmail === "function" &&
        reason.isEmail()
      ) {
        errorMessage =
          "Please use a valid email address. Temporary or disposable email addresses are not allowed.";
      }

      redirect(
        buildEarlyAccessUrl({
          error: errorMessage,
          email,
          companySize,
          sources: sourcesStr,
        })
      );
    }

    // Check if email already exists in our Redis cache for fast duplicate detection
    try {
      const emailExists = await redis.sismember(
        EARLY_ACCESS_EMAILS_SET_KEY,
        email
      );
      if (emailExists) {
        redirect(
          buildEarlyAccessUrl({
            error: "This email is already registered for early access!",
          })
        );
      }
    } catch (redisError) {
      // redirect() throws — must re-throw
      if (isRedirectError(redisError)) {
        throw redisError;
      }
      // Log Redis errors but don't block the user if Redis is down
      console.error("Redis error checking early access:", redisError);
      captureException(redisError, {
        tags: {
          action: "joinEarlyAccess:redis-check",
          email,
        },
      });
      // Continue with the request - Clerk will catch duplicates anyway
    }

    try {
      // Use Clerk's Backend API to add to waitlist with metadata
      const response = await fetch(
        "https://api.clerk.com/v1/waitlist_entries",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_address: email,
            // Store additional metadata about company size and sources
            public_metadata: {
              companySize,
              sources: sourcesStr,
              submittedAt: new Date().toISOString(),
            },
          }),
        }
      );

      if (!response.ok) {
        // Parse Clerk API error response
        const errorData = (await response.json()) as unknown;

        // Use improved Clerk error handler
        const errorResult = handleClerkError(errorData, {
          action: "joinEarlyAccess:api-call",
          email,
          httpStatus: response.status,
        });

        // Handle specific error cases
        if (errorResult.isAlreadyExists) {
          redirect(
            buildEarlyAccessUrl({
              error: "This email is already registered for early access!",
            })
          );
        }

        if (errorResult.isRateLimit) {
          redirect(
            buildEarlyAccessUrl({
              error: errorResult.userMessage,
              isRateLimit: true,
              email,
              companySize,
              sources: sourcesStr,
            })
          );
        }

        if (errorResult.isUserLocked) {
          const retryMessage = errorResult.retryAfterSeconds
            ? ` Please try again in ${Math.ceil(errorResult.retryAfterSeconds / 60)} minutes.`
            : " Please try again later.";
          redirect(
            buildEarlyAccessUrl({
              error: `Your account is temporarily locked.${retryMessage}`,
              email,
              companySize,
              sources: sourcesStr,
            })
          );
        }

        // For validation errors, return more specific message
        if (errorResult.isValidationError) {
          redirect(
            buildEarlyAccessUrl({
              error: errorResult.userMessage,
              email,
              companySize,
              sources: sourcesStr,
            })
          );
        }

        // For other errors, throw to be caught by outer handler
        throw new Error(errorResult.message);
      }

      // Track in Redis after response is sent (non-blocking)
      after(async () => {
        try {
          await redis.sadd(EARLY_ACCESS_EMAILS_SET_KEY, email);
        } catch (redisError) {
          console.error("Failed to add email to Redis tracking:", redisError);
          captureException(redisError, {
            tags: {
              action: "joinEarlyAccess:redis-add",
              email,
            },
          });
        }
      });

      // Success — redirect with success state
      redirect(
        buildEarlyAccessUrl({
          success: true,
          email,
        })
      );
    } catch (clerkError) {
      // redirect() throws — must re-throw
      if (isRedirectError(clerkError)) {
        throw clerkError;
      }

      // Handle unexpected Clerk errors
      console.error("Unexpected Clerk error:", clerkError);
      captureException(clerkError, {
        tags: {
          action: "joinEarlyAccess:unexpected",
          email,
        },
      });

      redirect(
        buildEarlyAccessUrl({
          error: "An unexpected error occurred. Please try again later.",
          email,
          companySize,
          sources: sourcesStr,
        })
      );
    }
  } catch (error) {
    // redirect() throws NEXT_REDIRECT — must re-throw it
    if (isRedirectError(error)) {
      throw error;
    }

    // Handle any outer errors (validation, etc.)
    console.error("Error in early access action:", error);
    captureException(error, {
      tags: {
        action: "joinEarlyAccess:outer",
      },
    });

    redirect(
      buildEarlyAccessUrl({
        error: "An error occurred. Please try again.",
      })
    );
  }
}
