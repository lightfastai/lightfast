import { redirect } from "next/navigation";

export default async function AccountSettingsPage() {
	// Redirect to general settings as the default page
	redirect("/account/settings/general");
}
