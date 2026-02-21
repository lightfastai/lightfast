import type { FeatureOGProps } from "../types";
import { colors } from "../brand";

export function FeatureLayout({ title, description }: FeatureOGProps) {
	return (
		<div
			tw="flex flex-col justify-center w-full h-full p-20"
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

			<div tw="flex flex-col" style={{ gap: "16px" }}>
				<div
					tw="font-bold"
					style={{
						fontSize: 56,
						fontFamily: "PP Neue Montreal",
						color: colors.foreground,
						lineHeight: 1.1,
						letterSpacing: "-0.02em",
					}}
				>
					{title}
				</div>
				{description && (
					<div
						tw="text-2xl font-normal"
						style={{
							fontFamily: "PP Neue Montreal",
							color: colors.mutedForeground,
							lineHeight: 1.4,
						}}
					>
						{description}
					</div>
				)}
			</div>

			<div
				tw="flex items-center mt-auto text-xl font-normal"
				style={{
					fontFamily: "PP Neue Montreal",
					color: colors.mutedForeground,
				}}
			>
				lightfast.ai
			</div>
		</div>
	);
}
