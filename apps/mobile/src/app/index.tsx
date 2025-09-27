import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAuth } from "@clerk/clerk-expo";
import { LegendList } from "@legendapp/list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/buttons";
import { trpc } from "~/utils/api";
import { randomUUID } from "~/utils/uuid";
import { AppIcons } from "~/components/ui/app-icons";

const LIMIT = 20;

function formatDateOnly(createdAt: Date | string) {
	try {
		const value =
			typeof createdAt === "string" ? new Date(createdAt) : createdAt;
		if (Number.isNaN(value.getTime())) return "";
		const months = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sept",
			"Oct",
			"Nov",
			"Dec",
		];
		return `${value.getDate()} ${months[value.getMonth()]} ${value.getFullYear()}`;
	} catch (error) {
		console.warn("Failed to format createdAt", error);
		return "";
	}
}

function SessionsList({ search }: { search: string }) {
	const { isSignedIn } = useAuth();

	const listQuery = useQuery({
		...trpc.session.list.queryOptions({ limit: LIMIT }),
		enabled: isSignedIn && search.trim().length === 0,
	});

	const searchQuery = useQuery({
		...trpc.session.search.queryOptions({ query: search.trim(), limit: LIMIT }),
		enabled: isSignedIn && search.trim().length > 0,
	});

	const {
		data: sessions = [],
		fetchStatus,
		error,
	} = useMemo(() => {
		return search.trim().length > 0
			? {
					data: searchQuery.data ?? [],
					fetchStatus: searchQuery.fetchStatus,
					error: searchQuery.error as unknown as Error | null,
				}
			: {
					data: listQuery.data ?? [],
					fetchStatus: listQuery.fetchStatus,
					error: listQuery.error as unknown as Error | null,
				};
	}, [
		search,
		listQuery.data,
		listQuery.fetchStatus,
		listQuery.error,
		searchQuery.data,
		searchQuery.fetchStatus,
		searchQuery.error,
	]);

	const handleRefetch = useCallback(() => {
		if (search.trim().length > 0) {
			void searchQuery.refetch();
		} else {
			void listQuery.refetch();
		}
	}, [listQuery, searchQuery, search]);

	if (fetchStatus === "fetching" && sessions.length === 0) {
		return (
			<View className="mt-8 flex flex-row items-center justify-center">
				<ActivityIndicator color="#808080" />
				<Text className="ml-2 text-muted-foreground">Loading sessions...</Text>
			</View>
		);
	}

	if (error) {
		return (
			<View className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
				<Text className="text-lg font-semibold text-destructive">
					Unable to load sessions
				</Text>
				<Text className="mt-2 text-muted-foreground">
					{(error as Error).message}
				</Text>
				<Button className="mt-4" onPress={handleRefetch}>
					<Button.Text>Try again</Button.Text>
				</Button>
			</View>
		);
	}

	if (sessions.length === 0) {
		return (
			<View className="mt-6 rounded-lg border border-dashed border-muted/40 bg-muted/40 p-4">
				<Text className="text-lg font-semibold text-foreground">
					No conversations yet
				</Text>
				<Text className="mt-2 text-muted-foreground">
					Start a chat on desktop and it will appear here automatically.
				</Text>
			</View>
		);
	}

	return (
		<View className="flex-1 gap-3">
			<LegendList
				data={sessions}
				estimatedItemSize={72}
				ItemSeparatorComponent={() => <View className="h-1" />}
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 16 }}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => {
					const sessionTitle =
						item.title && item.title.trim().length > 0
							? item.title
							: "Untitled conversation";

					return (
						<Pressable
							className="p-2"
	onPress={() => router.push(`/chat/${item.id}`)}
						>
							<Text className="text-lg font-semibold text-foreground">
								{sessionTitle}
							</Text>
							<Text className="mt-1 text-sm text-muted-foreground">
								{formatDateOnly(item.createdAt)}
							</Text>
						</Pressable>
					);
				}}
			/>
		</View>
	);
}

export default function HomePage() {
	const { isLoaded, isSignedIn } = useAuth();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");

	const createSession = useMutation({
		...trpc.session.create.mutationOptions(),
		onSuccess: (res) => {
			// Optimistically refresh the list
			void queryClient.invalidateQueries({
				queryKey: trpc.session.list.queryOptions({ limit: LIMIT }).queryKey,
			});
		router.push(`/chat/${res.id}`);
		},
	});

	if (!isLoaded) {
		return (
			<SafeAreaView className="bg-background">
				<Stack.Screen options={{ title: "Chats" }} />
				<View className="h-full w-full items-center justify-center bg-background">
					<ActivityIndicator color="#808080" />
				</View>
			</SafeAreaView>
		);
	}

	if (!isSignedIn) {
		return <Redirect href="/(auth)/sign-in" />;
	}

	return (
		<SafeAreaView className="bg-background flex-1">
			<Stack.Screen options={{ title: "Chats" }} />
			<View className="flex-1 gap-4 bg-background p-4">
				{/* Header */}
				<View className="mb-1 w-full flex-row items-center justify-between">
					<Text className="text-2xl font-bold text-foreground">Chats</Text>
					<Pressable
						accessibilityRole="button"
						onPress={() => {
							const id = randomUUID();
							createSession.mutate({ id });
						}}
						className="p-1"
					>
						<AppIcons.MessageCirclePlus color="#fff" />
					</Pressable>
				</View>

				{/* Search bar with leading icon (center aligned) */}
				<View className="h-12 flex-row items-center rounded-md border border-input bg-background px-3">
					<AppIcons.Search color="hsl(0 0% 60%)" />
					<Input
						placeholder="Search Chat"
						value={search}
						onChangeText={setSearch}
						className="h-12 flex-1 border-0 bg-transparent px-0 pl-2 rounded-none"
					/>
				</View>

				<SessionsList search={search} />
			</View>
		</SafeAreaView>
	);
}
