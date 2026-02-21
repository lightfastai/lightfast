import { colors } from "../brand";

export function HomeLayout() {
	return (
		<div
			tw="flex items-center justify-center w-full h-full"
			style={{ backgroundColor: colors.background }}
		>
			<div
				tw="text-6xl font-medium"
				style={{
					fontFamily: "PP Neue Montreal",
					color: colors.foreground,
				}}
			>
				Lightfast
			</div>
		</div>
	);
}
