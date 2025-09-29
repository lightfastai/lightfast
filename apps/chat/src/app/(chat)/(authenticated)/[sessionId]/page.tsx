import { Suspense } from "react";
import {
	HydrateClient,
	prefetch,
	trpc,
	createCaller,
	getQueryClient,
} from "@repo/chat-trpc/server";
import { ChatLoadingSkeleton } from "../_components/chat-loading-skeleton";
import { ExistingSessionChat } from "../_components/existing-session-chat";
import {
	MESSAGE_INITIAL_CHAR_BUDGET,
	MESSAGE_FALLBACK_PAGE_SIZE,
} from "~/lib/messages/loading";
import type { ChatRouterOutputs } from "@api/chat";

type MessagePage = ChatRouterOutputs["message"]["listInfinite"];
type MessageCursor = NonNullable<MessagePage["nextCursor"]>;

const MAX_MESSAGE_PAGES = 256;

// Server-side loader that eagerly walks the infinite cursor until exhaustion.
// The resulting pages land in the React Query cache before hydration so the
// client `useSuspenseInfiniteQuery` call instantly receives the full history.
async function prefetchFullMessageHistory(sessionId: string) {
	const messagesInfiniteOptions = trpc.message.listInfinite.infiniteQueryOptions({
		sessionId,
		limitChars: MESSAGE_INITIAL_CHAR_BUDGET,
		limitMessages: MESSAGE_FALLBACK_PAGE_SIZE,
	});

	const queryClient = getQueryClient();
	const caller = await createCaller();

	const pages: MessagePage[] = [];
	const pageParams: (MessageCursor | null)[] = [];

	let cursor: MessageCursor | null = null;
	let truncated = false;

	for (let index = 0; index < MAX_MESSAGE_PAGES; index += 1) {
		const page = await caller.message.listInfinite({
			sessionId,
			limitChars: MESSAGE_INITIAL_CHAR_BUDGET,
			limitMessages: MESSAGE_FALLBACK_PAGE_SIZE,
			cursor,
		});

		pages.push(page);
		pageParams.push(cursor);

		const nextCursor = page.nextCursor;
		if (!nextCursor) {
			break;
		}

		if (
			cursor &&
			nextCursor.createdAt === cursor.createdAt &&
			nextCursor.id === cursor.id
		) {
			break;
		}

		cursor = nextCursor;

		// If we have iterated through the maximum configured pages, stop fetching.
		if (index === MAX_MESSAGE_PAGES - 1) {
			truncated = true;
		}
	}

	queryClient.setQueryData(messagesInfiniteOptions.queryKey, {
		pages,
		pageParams,
	});

	if (truncated) {
		console.warn(
			`[chat] Truncated message history prefetch for session ${sessionId} after ${MAX_MESSAGE_PAGES} pages.`,
		);
	}
}

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

interface PrefetchedExistingSessionProps {
	sessionId: string;
	agentId: string;
}

async function PrefetchedExistingSession({
	sessionId,
	agentId,
}: PrefetchedExistingSessionProps) {
	await prefetchFullMessageHistory(sessionId);

	// Hydrate once the cache is populated so downstream client hooks hydrate
	// synchronously with the full conversation state.
	return (
		<HydrateClient>
			<ExistingSessionChat sessionId={sessionId} agentId={agentId} />
		</HydrateClient>
	);
}

export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010"; // Default agent ID

	// Prefetch lightweight session metadata and hydrate the full message history before render.
	prefetch(trpc.session.getMetadata.queryOptions({ sessionId }));

	// Suspense keeps showing ChatLoadingSkeleton while the history prefetch runs.
	return (
		<Suspense fallback={<ChatLoadingSkeleton />}>
			<PrefetchedExistingSession sessionId={sessionId} agentId={agentId} />
		</Suspense>
	);
}
