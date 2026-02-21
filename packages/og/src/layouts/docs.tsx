import type { DocsOGProps } from "../types";
import { colors } from "../brand";

export function DocsLayout({ title, section, breadcrumb }: DocsOGProps) {
	return (
		<div
			tw="flex flex-col w-full h-full p-20"
			style={{ backgroundColor: colors.background }}
		>
			<div
				tw="flex items-center mb-10 text-xl"
				style={{ gap: "8px", fontFamily: "PP Neue Montreal" }}
			>
				<span tw="font-medium" style={{ color: colors.foreground }}>
					Lightfast
				</span>
				<span style={{ color: colors.border }}>/</span>
				<span tw="font-normal" style={{ color: colors.mutedForeground }}>
					Docs
				</span>
			</div>

			{(section ?? (breadcrumb && breadcrumb.length > 0)) && (
				<div
					tw="flex items-center mb-4 font-normal"
					style={{
						gap: "8px",
						fontSize: 18,
						fontFamily: "PP Neue Montreal",
						color: colors.mutedForeground,
					}}
				>
					{section && <span>{section}</span>}
					{!section &&
						breadcrumb?.map((crumb, i) => (
							<span
								key={crumb}
								tw="flex items-center"
								style={{ gap: "8px" }}
							>
								{i > 0 && (
									<span style={{ color: colors.border }}>
										/
									</span>
								)}
								<span>{crumb}</span>
							</span>
						))}
				</div>
			)}

			<div tw="flex flex-1 items-center">
				<div
					tw="font-bold"
					style={{
						fontSize: 52,
						fontFamily: "PP Neue Montreal",
						color: colors.foreground,
						lineHeight: 1.15,
						letterSpacing: "-0.02em",
					}}
				>
					{title}
				</div>
			</div>

			<div
				tw="flex items-center mt-auto font-normal"
				style={{
					fontSize: 18,
					fontFamily: "PP Neue Montreal",
					color: colors.mutedForeground,
				}}
			>
				docs.lightfast.ai
			</div>
		</div>
	);
}
