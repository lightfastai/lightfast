"use server";

import { captureException } from "@sentry/nextjs";
import { isClerkAPIResponseError } from "@vendor/clerk";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
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
import { getAuthTraceContext } from "~/lib/observability";
import { serializeEarlyAccessParams } from "../_lib/search-params";

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

// Configure Arcjet protection for early access signup
const aj = arcjet({
  key: ARCJET_KEY,
  characteristics: ["ip.src"],
  rules: [
    validateEmail({
      mode: "LIVE",
      deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
    }),
    shield({
      mode: env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN",
    }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:MONITOR"],
    }),
    slidingWindow({
      mode: "LIVE",
      interval: "1h",
      max: 10,
    }),
    slidingWindow({
      mode: "LIVE",
      interval: "24h",
      max: 50,
    }),
    fixedWindow({
      mode: "LIVE",
      window: "10s",
      max: 3,
    }),
  ],
});

export async function joinEarlyAccessAction(
  formData: FormData
): Promise<never> {
  // Hoisted before try so catch block can preserve form state on error redirects
  const rawEmail = (formData.get("email") as string | null) ?? "";
  const rawCompanySize = (formData.get("companySize") as string | null) ?? "";
  const rawSources = (formData.get("sources") as string | null) ?? "";

  try {
    // Validate form data
    const validatedFields = earlyAccessSchema.safeParse({
      email: rawEmail,
      companySize: rawCompanySize,
      sources: rawSources.split(",").filter(Boolean),
    });

    // Redirect with field errors if validation fails
    if (!validatedFields.success) {
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      log.warn("Early access form validation failed", {
        errors: fieldErrors,
        ...getAuthTraceContext(),
      });
      redirect(
        serializeEarlyAccessParams("/early-access", {
          email: rawEmail,
          companySize: rawCompanySize,
          sources: rawSources,
          emailError: fieldErrors.email?.[0] ?? null,
          companySizeError: fieldErrors.companySize?.[0] ?? null,
          sourcesError: fieldErrors.sources?.[0] ?? null,
        })
      );
    }

    // Fields have been validated
    const { email, companySize, sources } = validatedFields.data;
    const sourcesStr = sources.join(",");

    // Check Arcjet protection with the validated email
    const req = await request();
    const decision = await aj.protect(req, { email });

    // Handle denied requests from Arcjet
    if (decision.isDenied()) {
      const reason = decision.reason;
      log.warn("Early access blocked by Arcjet", {
        reason: reason.type,
        ...getAuthTraceContext(),
      });

      if (reason.isRateLimit()) {
        redirect(
          serializeEarlyAccessParams("/early-access", {
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
        serializeEarlyAccessParams("/early-access", {
          error: errorMessage,
          email,
          companySize,
          sources: sourcesStr,
        })
      );
    }

    // Check if email already exists in Redis for fast duplicate detection
    try {
      const emailExists = await redis.sismember(
        EARLY_ACCESS_EMAILS_SET_KEY,
        email
      );
      if (emailExists) {
        // Already registered — show success state (they're already on the list)
        log.info("Early access duplicate email", {
          ...getAuthTraceContext(),
        });
        redirect(
          serializeEarlyAccessParams("/early-access", {
            success: true,
            email,
          })
        );
      }
    } catch (redisError) {
      if (isRedirectError(redisError)) {
        throw redisError;
      }
      log.error("Redis early-access check failed", {
        error: String(redisError),
        ...getAuthTraceContext(),
      });
      captureException(redisError, {
        tags: { action: "joinEarlyAccess:redis-check", email },
      });
    }

    // Add to Clerk waitlist via SDK
    const clerk = await clerkClient();
    await clerk.waitlistEntries.create({ emailAddress: email });
    log.info("Early access waitlist entry created", {
      ...getAuthTraceContext(),
    });

    // Track in Redis after response is sent (non-blocking)
    after(async () => {
      try {
        await redis.sadd(EARLY_ACCESS_EMAILS_SET_KEY, email);
      } catch (redisError) {
        log.error("Redis early-access tracking failed", {
          error: String(redisError),
          ...getAuthTraceContext(),
        });
        captureException(redisError, {
          tags: { action: "joinEarlyAccess:redis-add", email },
        });
      }
    });

    // Success — redirect with success state
    redirect(
      serializeEarlyAccessParams("/early-access", {
        success: true,
        email,
      })
    );
  } catch (error) {
    // redirect() throws NEXT_REDIRECT — must re-throw
    if (isRedirectError(error)) {
      throw error;
    }

    // Handle Clerk SDK errors with typed error checking
    if (isClerkAPIResponseError(error)) {
      const code = error.errors[0]?.code;

      if (
        code === "email_address_exists" ||
        code === "form_identifier_exists"
      ) {
        // Already registered — show success state (they're already on the list)
        redirect(
          serializeEarlyAccessParams("/early-access", {
            success: true,
            email: rawEmail,
          })
        );
      }

      if (
        error.status === 429 ||
        code === "too_many_requests" ||
        code === "rate_limit_exceeded"
      ) {
        redirect(
          serializeEarlyAccessParams("/early-access", {
            error: "Too many signup attempts. Please try again later.",
            isRateLimit: true,
            email: rawEmail,
            companySize: rawCompanySize,
            sources: rawSources,
          })
        );
      }

      if (code === "user_locked") {
        const seconds = (error.errors[0]?.meta as Record<string, unknown>)
          ?.lockout_expires_in_seconds as number | undefined;
        redirect(
          serializeEarlyAccessParams("/early-access", {
            error: seconds
              ? `Your account is temporarily locked. Please try again in ${Math.ceil(seconds / 60)} minutes.`
              : "Your account is temporarily locked. Please try again later.",
            email: rawEmail,
            companySize: rawCompanySize,
            sources: rawSources,
          })
        );
      }

      // All other Clerk errors: log + generic message
      captureException(error, {
        tags: { action: "joinEarlyAccess:clerk" },
      });
      log.error("Clerk waitlist error", {
        code: error.errors[0]?.code,
        message: error.errors[0]?.longMessage,
        ...getAuthTraceContext(),
      });
      redirect(
        serializeEarlyAccessParams("/early-access", {
          error:
            error.errors[0]?.longMessage ??
            "An unexpected error occurred. Please try again.",
          email: rawEmail,
          companySize: rawCompanySize,
          sources: rawSources,
        })
      );
    }

    // Non-Clerk errors
    parseError(error);
    redirect(
      serializeEarlyAccessParams("/early-access", {
        error: "An error occurred. Please try again.",
        email: rawEmail,
        companySize: rawCompanySize,
        sources: rawSources,
      })
    );
  }
}
