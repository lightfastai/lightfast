/**
 * Group array items by a key and count occurrences.
 */
export function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
	return arr.reduce(
		(acc, item) => {
			const k = String(item[key]);
			acc[k] = (acc[k] ?? 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);
}

/**
 * Build recipient objects from Clerk organization member data.
 * Returns plain objects compatible with both Knock's RecipientRequest
 * and our internal Recipient interface.
 */
export function buildRecipientsFromMembers(
	members: { publicUserData?: { userId?: string | null; identifier?: string | null; firstName?: string | null } | null }[],
) {
	return members
		.filter(
			(m) => m.publicUserData?.userId && m.publicUserData.identifier,
		)
		.map((m) => ({
			id: m.publicUserData?.userId ?? "",
			email: m.publicUserData?.identifier ?? "",
			name: m.publicUserData?.firstName ?? undefined,
		}));
}
