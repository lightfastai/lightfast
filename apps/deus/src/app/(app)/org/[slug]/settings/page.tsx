import { redirect } from "next/navigation";

export default async function SettingsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	// Redirect to data-controls as the default settings page
	redirect(`/org/${slug}/settings/data-controls`);
}
