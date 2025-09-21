import { Redirect, Stack } from "expo-router";
import { View } from "react-native";

import { useAuth } from "@clerk/clerk-expo";

export default function AuthLayout() {
	const { isLoaded, isSignedIn } = useAuth();

	if (!isLoaded) {
		return <View className="flex-1 bg-background" />;
	}

	if (isSignedIn) {
		return <Redirect href="/" />;
	}

	return <Stack screenOptions={{ headerShown: false }} />;
}
