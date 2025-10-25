import { CodeEditor } from "@/src/components/code-editor";

const products = [
	{
		name: "cloud",
		title: "Lightfast Cloud",
		description: "Deploy and manage AI agents at scale with our cloud platform",
		gradient: "from-blue-400 via-purple-400 to-indigo-400",
		href: "/cloud",
	},
	{
		name: "chat",
		title: "Lightfast Chat",
		description:
			"Our in-house chat experience that provides multiple models out of the box",
		gradient: "from-purple-400 via-pink-400 to-red-400",
		href: "/chat",
	},
];

export function DeveloperPlatformLanding() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-16">
            <div className="mx-auto">
				{/* Header */}
				<div className="text-left">
					<h1 className="text-3xl font-semibold tracking-tight mb-6">
						Lightfast Cloud Docs
					</h1>
				</div>

				{/* Main Content Grid */}
                <div className="grid bg-muted/20 rounded-xl p-6 lg:grid-cols-2 gap-12 items-start mb-20">
					{/* Left Column - Description */}
					<div>
						<h2 className="text-sm font-semibold mb-6">Developer quickstart</h2>
						<p className="text-md text-muted-foreground mb-6 leading-relaxed">
							Make your first agent request in minutes. Learn the basics of the
							Lightfast platform.
						</p>
					</div>

					{/* Right Column - Code Editor */}
					<div>
						<CodeEditor />
					</div>
				</div>

				{/* Products Section */}
				<div className="mb-16">
					<div className="flex justify-between items-center mb-8">
						<h2 className="text-2xl font-semibold">Explore products</h2>
					</div>
					<div className="grid md:grid-cols-2 gap-6">
						{products.map((product) => (
							<a
								key={product.name}
								href={product.href}
								className="group cursor-pointer block"
							>
								{/* Gradient Card */}
								<div
									className={`relative h-32 bg-gradient-to-br ${product.gradient} rounded-lg mb-4 transition-transform group-hover:scale-105`}
								>
									<div className="absolute inset-0 bg-black/10 rounded-lg" />
									<div className="absolute inset-0 flex items-center justify-center">
										<h3 className="text-white text-2xl font-semibold drop-shadow-lg">
											{product.title}
										</h3>
									</div>
								</div>

								{/* Card Content */}
								<div>
									<h4 className="text-xl font-semibold mb-2">
										{product.title}
									</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{product.description}
									</p>
								</div>
							</a>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
