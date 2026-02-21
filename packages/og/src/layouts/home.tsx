import { colors } from "../brand";
import { lissajousPath } from "../brand/logo";

const LOGO_SIZE = 64;

export function HomeLayout() {
	return (
		<div
			tw="flex items-center justify-center w-full h-full"
			style={{ backgroundColor: colors.background }}
		>
			<div tw="flex items-center" style={{ gap: "20px" }}>
				<svg
					width={LOGO_SIZE}
					height={LOGO_SIZE}
					viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}
				>
					<path
						d={lissajousPath(LOGO_SIZE, 0.05)}
						fill="none"
						stroke={colors.foreground}
						strokeWidth={5}
					/>
				</svg>
				<div
					tw="text-6xl font-medium"
					style={{
						fontFamily: "PP Supply Sans",
						color: colors.foreground,
						letterSpacing: "0.05em",
					}}
				>
					Lightfast
				</div>
			</div>
		</div>
	);
}
