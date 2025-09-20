import { createCaller } from "~/trpc/server";
import { getMessageType } from "~/lib/billing/message-utils";
import { MessageType } from "~/lib/billing/types";
import { getCurrentPeriod } from "~/services/usage.service";

/**
 * Quota Reservation System
 * 
 * Implements atomic quota management using reservation pattern:
 * 1. Reserve quota (atomic check + decrement)
 * 2. Process request
 * 3. Confirm usage OR release reservation on failure
 * 
 * This prevents race conditions and ensures billing integrity.
 */

export interface QuotaReservation {
	reservationId: string;
	userId: string;
	modelId: string;
	messageType: MessageType;
	period: string;
	reservedAt: Date;
}

export class QuotaReservationError extends Error {
	public readonly code = "QUOTA_RESERVATION_ERROR";
	
	constructor(
		message: string,
		public readonly details: {
			userId: string;
			modelId: string;
			messageType: MessageType;
			remainingQuota: number;
		},
	) {
		super(message);
		this.name = "QuotaReservationError";
	}
}

export class QuotaReleaseError extends Error {
	public readonly code = "QUOTA_RELEASE_ERROR";

	constructor(message: string, public readonly reservationId: string, public readonly attempts: number, public readonly lastError?: unknown) {
		super(message);
		this.name = "QuotaReleaseError";
	}
}

/**
 * Reserve quota atomically - prevents race conditions
 * Returns reservation ID that must be confirmed or released
 */
export async function reserveQuota(
	userId: string,
	modelId: string,
	messageId: string, // For idempotency
	timezone?: string
): Promise<QuotaReservation> {
	const caller = await createCaller();
	const messageType = getMessageType(modelId);
	const period = await getCurrentPeriod(timezone, userId);
	
	try {
		// Atomic operation: check quota AND reserve it in one database transaction
		const reservation = await caller.usage.reserveQuota({
			userId,
			modelId,
			messageId, // Prevents duplicate reservations for same message
			messageType: messageType === MessageType.PREMIUM ? 'premium' : 'standard',
			period,
		});
		
		return {
			reservationId: reservation.id,
			userId,
			modelId,
			messageType,
			period,
			reservedAt: new Date(),
		};
		
	} catch (error) {
		// Handle quota exceeded or other reservation failures
		if (error instanceof Error) {
			if (error.message.includes('Quota exceeded')) {
				throw new QuotaReservationError(
					`Quota exceeded for ${messageType} messages`,
					{
						userId,
						modelId,
						messageType,
						remainingQuota: 0, // TODO: Extract from error cause
					}
				);
			}
			
			if (error.message.includes('Message already processed')) {
				throw new QuotaReservationError(
					'Message already processed',
					{
						userId,
						modelId,
						messageType,
						remainingQuota: 0,
					}
				);
			}
		}
		
		console.error('[QuotaReservation] Failed to reserve quota:', error);
		throw error;
	}
}

/**
 * Confirm quota usage - converts reservation to actual usage
 * Call this when message processing succeeds
 */
export async function confirmQuotaUsage(reservationId: string): Promise<void> {
	try {
		const caller = await createCaller();
		await caller.usage.confirmReservation({
			reservationId,
		});
		
		console.log(`[QuotaReservation] Confirmed usage for reservation: ${reservationId}`);
		
	} catch (error) {
		console.error(`[QuotaReservation] Failed to confirm reservation ${reservationId}:`, error);
		// This is critical - usage was delivered but not recorded
		// TODO: Add to retry queue or alert system
		throw error;
	}
}

/**
 * Release quota reservation - returns quota to user
 * Call this when message processing fails
 */
export async function releaseQuotaReservation(reservationId: string): Promise<void> {
	const caller = await createCaller();
	const maxAttempts = 3;
	let attempt = 0;
	let lastError: unknown;

	while (attempt < maxAttempts) {
		try {
			await caller.usage.releaseReservation({ reservationId });
			console.log(`[QuotaReservation] Released reservation: ${reservationId}`);
			return;
		} catch (error) {
			attempt += 1;
			lastError = error;
			console.error(
				`[QuotaReservation] Failed to release reservation ${reservationId} (attempt ${attempt}/${maxAttempts}):`,
				error,
			);
			if (attempt < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, attempt * 200));
			}
		}
	}

	throw new QuotaReleaseError(
		`Failed to release reservation after ${maxAttempts} attempts`,
		reservationId,
		maxAttempts,
		lastError,
	);
}


/**
 * Cleanup expired reservations (background job)
 * Reservations older than 1 hour should be released
 */
export async function cleanupExpiredReservations(): Promise<void> {
	try {
		const caller = await createCaller();
		const expiredBefore = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
		
		await caller.usage.cleanupExpiredReservations({
			expiredBefore: expiredBefore.toISOString(),
		});
		
		console.log('[QuotaReservation] Cleaned up expired reservations');
		
	} catch (error) {
		console.error('[QuotaReservation] Failed to cleanup expired reservations:', error);
	}
}
