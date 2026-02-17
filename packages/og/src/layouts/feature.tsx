import type { FeatureOGProps } from "../types";
import { colors, OG_HEIGHT, OG_WIDTH } from "../brand";
import { lissajousPath } from "../brand/logo";

export function FeatureLayout({ title, description }: FeatureOGProps) {
	const logoSize = 64;
	const logoPadding = 0.18;
	const logoStroke = Math.max(1, Math.round(logoSize * 0.035));

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				width: OG_WIDTH,
				height: OG_HEIGHT,
				backgroundColor: colors.background,
				padding: "80px",
			}}
		>
			<svg
				width={logoSize}
				height={logoSize}
				viewBox={`0 0 ${logoSize} ${logoSize}`}
				style={{ marginBottom: "40px" }}
			>
				<path
					d={lissajousPath(logoSize, logoPadding)}
					fill="none"
					stroke={colors.foreground}
					strokeWidth={logoStroke}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "16px",
				}}
			>
				<div
					style={{
						fontSize: 56,
						fontWeight: 700,
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
						style={{
							fontSize: 24,
							fontWeight: 400,
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
				style={{
					display: "flex",
					alignItems: "center",
					marginTop: "auto",
					fontSize: 20,
					fontWeight: 400,
					fontFamily: "PP Neue Montreal",
					color: colors.mutedForeground,
				}}
			>
				lightfast.ai
			</div>
		</div>
	);
}
