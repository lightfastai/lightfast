import type { ContentOGProps } from "../types";
import { colors, OG_HEIGHT, OG_WIDTH } from "../brand";
import { lissajousPath } from "../brand/logo";

export function ContentLayout({
	title,
	description,
	category,
	date,
	author,
}: ContentOGProps) {
	const logoSize = 48;
	const logoPadding = 0.14;
	const logoStroke = Math.max(1, Math.round(logoSize * 0.035));

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: OG_WIDTH,
				height: OG_HEIGHT,
				backgroundColor: colors.background,
				padding: "80px",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "16px",
					marginBottom: "40px",
				}}
			>
				<svg
					width={logoSize}
					height={logoSize}
					viewBox={`0 0 ${logoSize} ${logoSize}`}
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
						fontSize: 20,
						fontWeight: 700,
						fontFamily: "PP Neue Montreal",
						color: colors.foreground,
					}}
				>
					Lightfast
				</div>
			</div>

			{category && (
				<div
					style={{
						display: "flex",
						marginBottom: "16px",
					}}
				>
					<div
						style={{
							fontSize: 16,
							fontWeight: 700,
							fontFamily: "PP Neue Montreal",
							color: colors.brandBlue,
							textTransform: "uppercase",
							letterSpacing: "0.05em",
						}}
					>
						{category}
					</div>
				</div>
			)}

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "16px",
					flex: 1,
				}}
			>
				<div
					style={{
						fontSize: 48,
						fontWeight: 700,
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
						style={{
							fontSize: 22,
							fontWeight: 400,
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
				style={{
					display: "flex",
					alignItems: "center",
					gap: "16px",
					marginTop: "auto",
					fontSize: 18,
					fontWeight: 400,
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
