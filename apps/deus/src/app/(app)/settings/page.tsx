import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { UserDropdownMenu } from "~/components/user-dropdown-menu";
import { RepositorySettings } from "~/components/repository-settings";

export default function SettingsPage() {
	return (
		<div className="flex min-h-screen flex-col bg-gradient-to-b from-[#0b0b0f] via-[#050506] to-[#010104] text-foreground">
			<header className="flex items-center justify-between px-6 py-6">
				<Link
					href="/"
					className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] backdrop-blur transition hover:border-white/30 hover:bg-white/[0.08]"
				>
					<span className="sr-only">Lightfast home</span>
					<Icons.logoShort className="h-4 w-auto text-white" />
				</Link>
				<UserDropdownMenu />
			</header>

			<main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6">
				<div className="mb-8">
					<h1 className="text-3xl font-semibold tracking-tight text-white">
						Settings
					</h1>
					<p className="mt-2 text-muted-foreground">
						Manage your account and repository connections
					</p>
				</div>

				<RepositorySettings />
			</main>
		</div>
	);
}
