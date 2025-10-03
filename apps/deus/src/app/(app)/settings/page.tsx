import { redirect } from "next/navigation";

export default function SettingsPage() {
	// Redirect to data-controls as the default settings page
	redirect("/settings/data-controls");
}
