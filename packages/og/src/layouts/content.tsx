import type { ContentOGProps } from "../types";
import { colors } from "../brand";

export function ContentLayout({
	title,
	description,
	category,
	date,
	author,
}: ContentOGProps) {
	return (
		<div
			tw="flex flex-col w-full h-full p-20"
			style={{ backgroundColor: colors.background }}
		>
			<div
				tw="text-xl font-medium mb-10"
				style={{
					fontFamily: "PP Neue Montreal",
					color: colors.foreground,
				}}
			>
				Lightfast
			</div>

			{category && (
				<div tw="flex mb-4">
					<div
						tw="text-base font-bold uppercase"
						style={{
							fontFamily: "PP Neue Montreal",
							color: colors.brandBlue,
							letterSpacing: "0.05em",
						}}
					>
						{category}
					</div>
				</div>
			)}

			<div tw="flex flex-col flex-1" style={{ gap: "16px" }}>
				<div
					tw="text-5xl font-bold"
					style={{
						fontFamily: "PP Neue Montreal",
						color: colors.foreground,
						lineHeight: 1.1,
						letterSpacing: "-0.02em",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{title}
				</div>
				{description && (
					<div
						tw="font-normal"
						style={{
							fontSize: 22,
							fontFamily: "PP Neue Montreal",
							color: colors.mutedForeground,
							lineHeight: 1.4,
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{description}
					</div>
				)}
			</div>

			<div
				tw="flex items-center mt-auto"
				style={{
					gap: "16px",
					fontSize: 18,
					fontFamily: "PP Neue Montreal",
					color: colors.mutedForeground,
				}}
			>
				{author && <span>{author}</span>}
				{author && date && (
					<span style={{ color: colors.border }}>|</span>
				)}
				{date && <span>{date}</span>}
			</div>
		</div>
	);
}
