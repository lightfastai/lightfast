"use client";

import { ChatInterface } from "../../_components/chat-interface";
import { useCreateSession } from "~/hooks/use-create-session";
import { useSessionId } from "~/hooks/use-session-id";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { ArtifactViewer, useArtifact } from "~/components/artifacts";
import { Button } from "@repo/ui/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";

interface NewSessionChatProps {
	agentId: string;
}

/**
 * Component for creating new chat sessions.
 * Uses useSessionId hook to manage session ID generation and navigation.
 *
 * Flow:
 * 1. User visits /new -> Hook generates a fresh session ID
 * 2. User types and sends first message
 * 3. handleSessionCreation() is called -> Navigate to /{sessionId} via Next.js router
 * 4. Proper navigation ensures page component executes and data is prefetched
 * 5. If user hits back button to /new, a new ID is generated
 */
export function NewSessionChat({ agentId }: NewSessionChatProps) {
	// Use the hook to manage session ID generation and navigation state
	const { sessionId, isNewSession } = useSessionId();

	// Get user info - using suspense for instant loading
	const trpc = useTRPC();
	const { data: user } = useSuspenseQuery({
		...trpc.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
		refetchOnMount: false, // Prevent blocking navigation
		refetchOnWindowFocus: false, // Don't refetch on window focus
	});

	// Model selection (authenticated users only have model selection)
	const { selectedModelId } = useModelSelection(true);

	// Hook for creating sessions optimistically
	const createSession = useCreateSession();

	// Get query client to optimistically update cache
	const queryClient = useQueryClient();

	// Get the query key for messages
	const messagesQueryKey = trpc.message.list.queryOptions({
		sessionId,
	}).queryKey;

	// Handle session creation when the first message is sent
	const handleSessionCreation = (firstMessage: string) => {
		if (!isNewSession) {
			// Already transitioned to /{sessionId}, no need to create
			return;
		}

		// Update the URL immediately for instant feedback
		window.history.replaceState({}, "", `/${sessionId}`);

		// Create the session optimistically (fire-and-forget)
		// The backend will also create it if needed (upsert behavior)
		// This ensures instant UI updates without blocking message sending
		createSession.mutate({ id: sessionId, firstMessage });
	};

	// Artifact state for demo
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const { artifact, metadata, setMetadata, showArtifact, hideArtifact } = useArtifact();

	// Demo function to show artifact with mock data
	const showArtifactDemo = () => {
		showArtifact({
			documentId: 'demo-artifact',
			title: 'React Component Demo',
			kind: 'code',
			content: `import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
  step?: number;
}

export function Counter({ initialValue = 0, step = 1 }: CounterProps) {
  const [count, setCount] = useState(initialValue);

  const increment = () => setCount(prev => prev + step);
  const decrement = () => setCount(prev => prev - step);
  const reset = () => setCount(initialValue);

  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Counter Component</h2>
      
      <div className="text-center">
        <div className="text-3xl font-mono mb-4">{count}</div>
        
        <div className="flex gap-2 justify-center">
          <button 
            onClick={decrement}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            -
          </button>
          
          <button 
            onClick={reset}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset
          </button>
          
          <button 
            onClick={increment}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default Counter;`,
			status: 'idle',
			boundingBox: {
				top: 100,
				left: 100,
				width: 300,
				height: 200,
			},
		});
	};

	return (
		<div className="flex h-screen w-full overflow-hidden">
			{/* Chat interface - animates width when artifact is visible */}
			<motion.div 
				className="min-w-0 flex-shrink-0"
				initial={false}
				animate={{ 
					width: artifact.isVisible ? "50%" : "100%" 
				}}
				transition={{ 
					type: "spring", 
					stiffness: 300, 
					damping: 30,
					duration: 0.4 
				}}
			>
				<ChatInterface
					agentId={agentId}
					sessionId={sessionId}
					initialMessages={[]}
					isNewSession={isNewSession}
					handleSessionCreation={handleSessionCreation}
					user={user}
					onNewUserMessage={(userMessage) => {
						// Optimistically append the user message to the cache
						queryClient.setQueryData(messagesQueryKey, (oldData) => {
							const currentMessages = oldData ?? [];
							// Check if message with this ID already exists
							if (currentMessages.some(msg => msg.id === userMessage.id)) {
								return currentMessages;
							}
							return [
								...currentMessages,
								{
									id: userMessage.id,
									role: userMessage.role,
									parts: userMessage.parts,
									modelId: selectedModelId,
								},
							];
						});
					}}
					onNewAssistantMessage={(assistantMessage) => {
						// Optimistically append the assistant message to the cache
						queryClient.setQueryData(messagesQueryKey, (oldData) => {
							const currentMessages = oldData ?? [];
							// Check if message with this ID already exists
							if (currentMessages.some(msg => msg.id === assistantMessage.id)) {
								return currentMessages;
							}
							return [
								...currentMessages,
								{
									id: assistantMessage.id,
									role: assistantMessage.role,
									parts: assistantMessage.parts,
									modelId: null,
								},
							];
						});

						// Also trigger a background refetch to ensure data consistency
						// This will update with the actual database data once it's persisted
						void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
					}}
				/>
			</motion.div>

			{/* Artifact panel - slides in from right when visible */}
			<AnimatePresence>
				{artifact.isVisible && (
					<motion.div 
						className="w-1/2 min-w-0 flex-shrink-0 relative z-50"
						initial={{ x: "100%", opacity: 0 }}
						animate={{ 
							x: 0, 
							opacity: 1 
						}}
						exit={{ 
							x: "100%", 
							opacity: 0 
						}}
						transition={{ 
							type: "spring", 
							stiffness: 300, 
							damping: 30,
							duration: 0.4 
						}}
					>
						<ArtifactViewer
							artifact={artifact}
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							metadata={metadata}
							setMetadata={setMetadata}
							onClose={hideArtifact}
							onSaveContent={(content) => {
								// For demo purposes, just log the content
								console.log('Artifact content updated:', content);
							}}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Demo button when no artifact is shown */}
			{!artifact.isVisible && (
				<div className="fixed bottom-4 right-4">
					<Button 
						onClick={showArtifactDemo}
						className="z-50"
					>
						🧪 Show Artifact Demo
					</Button>
				</div>
			)}
		</div>
	);
}
