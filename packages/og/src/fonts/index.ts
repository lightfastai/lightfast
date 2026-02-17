export async function loadFonts(): Promise<
	{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]
> {
	const [book, bold] = await Promise.all([
		fetch(new URL("./PPNeueMontreal-Book.woff", import.meta.url)).then(
			(res) => res.arrayBuffer(),
		),
		fetch(new URL("./PPNeueMontreal-Bold.woff", import.meta.url)).then(
			(res) => res.arrayBuffer(),
		),
	]);

	return [
		{ name: "PP Neue Montreal", data: book, weight: 400, style: "normal" },
		{ name: "PP Neue Montreal", data: bold, weight: 700, style: "normal" },
	];
}
