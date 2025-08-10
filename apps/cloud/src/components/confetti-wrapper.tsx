"use client";

import dynamic from "next/dynamic";

const Confetti = dynamic(() => import("react-confetti"), {
	ssr: false,
});

export function ConfettiWrapper() {
	return (
		<Confetti
			recycle={false}
			numberOfPieces={200}
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 9999,
			}}
		/>
	);
}