import { redirect } from "next/navigation";

export default async function SettingsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	// Parent org layout handles membership; settings layout handles admin role
	const { slug } = await params;

	// Redirect to github-integration as the default settings page
	redirect(`/org/${slug}/settings/github-integration`);
}
