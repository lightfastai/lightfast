import "@/polyfills/polyfills";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import "../styles.css";

import { queryClient } from "~/utils/api";

// This is the main layout of the app
// It wraps your pages with the providers they need
export default function RootLayout() {
	const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

	if (!publishableKey) {
		throw new Error(
			"Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY env variable for Clerk.",
		);
	}

	return (
		<ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
			<QueryClientProvider client={queryClient}>
				{/*
            The Stack component displays the current page.
            It also allows you to configure your screens 
          */}
				<Stack
					screenOptions={{
						headerShown: false,
						contentStyle: {
							backgroundColor: "#1a1a1a", // HSL(0 0% 10%) - background color
						},
					}}
				/>
				<StatusBar />
			</QueryClientProvider>
		</ClerkProvider>
	);
}
