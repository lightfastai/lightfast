import type { Metadata } from "next";
import { ProfileSection } from "~/components/settings/profile-section";

export const metadata: Metadata = {
  title: "Profile Settings",
  description: "Manage your profile information and preferences.",
};

export default function ProfileSettingsPage() {
  return <ProfileSection />;
}