import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export const Icons = {
	logoShort: (props: IconProps) => (
		<svg
			viewBox="0 0 28 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M0.00254059 15.9114V0.468937H3.30854V15.0197L1.48154 13.1274H10.4208V15.9114H0.00254059Z"
				fill="currentColor"
			/>
			<path
				d="M18.1709 15.8683H14.3535L23.2735 0.418152H27.0909L18.1709 15.8683Z"
				fill="currentColor"
			/>
		</svg>
	),
};