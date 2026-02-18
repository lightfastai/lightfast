import type { DocsOGProps } from "../types";
import { colors, OG_HEIGHT, OG_WIDTH } from "../brand";
import { lissajousPath } from "../brand/logo";

export function DocsLayout({ title, section, breadcrumb }: DocsOGProps) {
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
						display: "flex",
						alignItems: "center",
						gap: "8px",
						fontSize: 20,
						fontFamily: "PP Neue Montreal",
					}}
				>
					<span style={{ fontWeight: 700, color: colors.foreground }}>
						Lightfast
					</span>
					<span style={{ color: colors.border }}>/</span>
					<span style={{ fontWeight: 400, color: colors.mutedForeground }}>
						Docs
					</span>
				</div>
			</div>

			{(section || (breadcrumb && breadcrumb.length > 0)) && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						marginBottom: "16px",
						fontSize: 18,
						fontWeight: 400,
						fontFamily: "PP Neue Montreal",
						color: colors.mutedForeground,
					}}
				>
					{section && <span>{section}</span>}
					{!section &&
						breadcrumb?.map((crumb, i) => (
							<span
								key={crumb}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
								}}
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

			<div
				style={{
					display: "flex",
					flex: 1,
					alignItems: "center",
				}}
			>
				<div
					style={{
						fontSize: 52,
						fontWeight: 700,
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
				style={{
					display: "flex",
					alignItems: "center",
					marginTop: "auto",
					fontSize: 18,
					fontWeight: 400,
					fontFamily: "PP Neue Montreal",
					color: colors.mutedForeground,
				}}
			>
				docs.lightfast.ai
			</div>
		</div>
	);
}
