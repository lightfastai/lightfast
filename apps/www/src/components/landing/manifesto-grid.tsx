export function ManifestoGrid() {
	return (
		<div className="w-full">
			{/* Grid Container - 12 columns, 3 rows */}
			<div className="grid grid-cols-12 gap-0 border border-border">
				{/* Row 1 */}
				<div className="col-span-2 border-r border-b border-border p-6 flex items-end transition-colors duration-200 hover:bg-accent">
					<p className="text-sm leading-relaxed text-foreground/80">
						DESIGNERS
						<br />
						AND
					</p>
				</div>
				<div className="col-span-3 border-r border-b border-border p-6 flex items-end transition-colors duration-200 hover:bg-accent">
					<p className="text-sm leading-relaxed text-foreground/80">DEVELOPERS</p>
				</div>
				<div className="col-span-4 border-r border-b border-border p-6 flex items-end transition-colors duration-200 hover:bg-accent">
					<div className="space-y-2">
						<p className="text-sm leading-relaxed text-foreground/80">
							OUR CULTURE
							<br />
							IS A<br />
							REFLECTION
							<br />
							OF OUR
							<br />
							SHARED
							<br />
							VALUES,
							<br />
							ATTITUDES,
							<br />
							BELIEFS, AND
							<br />
							WORKING
							<br />
							PRACTICES.
						</p>
					</div>
				</div>
				<div className="col-span-2 border-r border-b border-border p-6 flex items-end transition-colors duration-200 hover:bg-accent">
					<p className="text-sm leading-relaxed text-foreground/80">WHO</p>
				</div>
				<div className="col-span-1 border-b border-border transition-colors duration-200 hover:bg-accent" />

				{/* Row 2 */}
				<div className="col-span-2 border-r border-b border-border p-6 flex items-start transition-colors duration-200 hover:bg-accent">
					<p className="text-sm leading-relaxed text-foreground/80">
						GOOD IS NOT
						<br />
						WHERE WE
						<br />
						STOP. IT'S
						<br />
						WHERE WE
						<br />
						BEGIN.
					</p>
				</div>
				<div className="col-span-1 border-r border-b border-border transition-colors duration-200 hover:bg-accent" />
				<div className="col-span-6 border-r border-b border-border transition-colors duration-200 hover:bg-accent" />
				<div className="col-span-2 border-r border-b border-border p-6 flex items-start transition-colors duration-200 hover:bg-accent">
					<p className="text-sm leading-relaxed text-foreground/80">YOUR USERS</p>
				</div>
				<div className="col-span-1 border-b border-border transition-colors duration-200 hover:bg-accent" />

				{/* Row 3 */}
				<div className="col-span-5 border-r border-border transition-colors duration-200 hover:bg-accent" />
				<div className="col-span-1 border-r border-border p-6 flex items-start transition-colors duration-200 hover:bg-accent">
					<p className="text-sm leading-relaxed text-foreground/80">WILL</p>
				</div>
				<div className="col-span-4 border-r border-border transition-colors duration-200 hover:bg-accent" />
				<div className="col-span-2 border-border p-6 flex items-start transition-colors duration-200 hover:bg-accent">
					<p className="text-sm leading-relaxed text-foreground/80">LOVE!</p>
				</div>
			</div>
		</div>
	);
}
