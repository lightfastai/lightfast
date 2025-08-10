export { redis } from "@vendor/upstash";

// Use a single hash for all waitlist entries (more efficient)
export const REDIS_KEYS = {
	WAITLIST: "waitlist", // Single hash for all entries
} as const;