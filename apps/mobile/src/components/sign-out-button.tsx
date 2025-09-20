import { useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  };

  return (
    <TouchableOpacity
      className={className ?? "rounded-md bg-accent px-4 py-2"}
      onPress={handleSignOut}
    >
      <Text className="text-center text-base font-medium text-foreground">
        Sign out
      </Text>
    </TouchableOpacity>
  );
}
