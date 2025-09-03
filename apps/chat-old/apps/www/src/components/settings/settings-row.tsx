import type { ReactNode } from "react";

interface SettingsRowProps {
	title: string;
	description: ReactNode;
	children: ReactNode;
}

export function SettingsRow({
	title,
	description,
	children,
}: SettingsRowProps) {
	return (
		<div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
			<div className="flex-1 space-y-1">
				<h3 className="text-sm font-medium">{title}</h3>
				<div className="text-sm text-muted-foreground">{description}</div>
			</div>
			<div className="flex items-center space-x-2">{children}</div>
		</div>
	);
}
