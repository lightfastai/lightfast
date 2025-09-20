"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, MessageSquare } from "lucide-react";

import type { ChatRouterOutputs } from "@api/chat";
import { DataStreamProvider } from "~/hooks/use-data-stream";
import { ChatMessages } from "../../_components/chat-messages";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";
import type { ChatStatus } from "ai";
import { Button } from "@repo/ui/components/ui/button";

const readyStatus: ChatStatus = "ready";

type SharedSessionPayload = ChatRouterOutputs["share"]["get"];

export function SharedSessionView({ session, messages }: SharedSessionPayload) {
	const processedMessages = useMemo<LightfastAppChatUIMessage[]>(
		() =>
			messages.map((message) => ({
				id: message.id,
				role: message.role,
				parts: message.parts,
			})) as LightfastAppChatUIMessage[],
		[messages],
	);

	const hasMessages = processedMessages.length > 0;

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			<header className="border-b border-border/60 px-4 py-3">
				<h1 className="text-xs font-medium text-foreground">
					{session.title || "Lightfast Chat"}
				</h1>
			</header>

			<main className="flex-1">
				<div className="mx-auto w-full space-y-4 py-6">
					<div className="mx-auto max-w-3xl rounded-lg border border-border/60 bg-background/80">
						<div className="mx-auto flex items-start gap-3 py-3 text-xs text-muted-foreground px-4">
							<AlertTriangle
								className="mt-0.5 h-4 w-4 text-amber-500"
								aria-hidden="true"
							/>
							<div className="space-y-1 leading-relaxed">
								<span className="block">
									This is a copy of a chat between Lightfast and an anonymous
									user. Content may include unverified or unsafe material that
									does not represent Lightfast&apos;s views.
								</span>
								<span className="block">
									Shared snapshots may contain attachments and data not
									displayed here.
								</span>
							</div>
						</div>
					</div>
					<DataStreamProvider>
						{hasMessages ? (
							<div className="rounded-lg bg-background/80 p-4">
								<ChatMessages
									messages={processedMessages}
									status={readyStatus}
									_isAuthenticated={false}
									hasActiveStream={false}
									isExistingSessionWithNoMessages={!hasMessages}
								/>
							</div>
						) : (
							<div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center rounded-lg bg-background/80 p-8">
								<MessageSquare className="h-10 w-10 text-muted-foreground" />
								<div className="space-y-1">
									<p className="text-sm font-medium text-foreground">
										No messages yet
									</p>
									<p className="text-xs text-muted-foreground">
										The owner hasn&apos;t added any messages to this
										conversation.
									</p>
								</div>
							</div>
						)}
					</DataStreamProvider>
					<div className="flex justify-center pt-4">
						<Button asChild size="lg" className="text-sm">
							<Link href="/new">Start your own conversation</Link>
						</Button>
					</div>
				</div>
			</main>
		</div>
	);
}
