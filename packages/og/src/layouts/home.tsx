import type { HomeOGProps } from "../types";
import { colors, OG_HEIGHT, OG_WIDTH } from "../brand";
import { lissajousPath } from "../brand/logo";

export function HomeLayout({ tagline }: HomeOGProps) {
	const logoSize = 120;
	const logoPadding = 0.22;
	const logoStroke = Math.max(1, Math.round(logoSize * 0.035));

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
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
				style={{ marginBottom: "32px" }}
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
					fontSize: 64,
					fontWeight: 700,
					fontFamily: "PP Neue Montreal",
					color: colors.foreground,
					letterSpacing: "-0.03em",
					marginBottom: "16px",
				}}
			>
				Lightfast
			</div>

			{tagline && (
				<div
					style={{
						fontSize: 28,
						fontWeight: 400,
						fontFamily: "PP Neue Montreal",
						color: colors.mutedForeground,
						textAlign: "center",
						lineHeight: 1.4,
					}}
				>
					{tagline}
				</div>
			)}
		</div>
	);
}
