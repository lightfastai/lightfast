import Link from "next/link";
import Image from "next/image";
import { CodeEditor } from "@/src/components/code-editor";
import { exposureTrial } from "@/src/lib/fonts";

const products = [
  {
    name: "cloud",
    title: "Lightfast Cloud",
    description: "Deploy and manage AI agents at scale with our cloud platform",
    image: "/images/cloud-preview.webp",
    href: "/cloud",
  },
  {
    name: "chat",
    title: "Lightfast Chat",
    description:
      "Our in-house chat experience that provides multiple models out of the box",
    image: "/images/chat-preview.webp",
    href: "/chat",
  },
];

export function DeveloperPlatformLanding() {
  return (
    <div className="mx-auto">
      {/* Header Section */}
      <div className="section-gap-b">
        <div className="space-y-3">
          <h1
            className={`text-6xl font-light leading-[1.2] tracking-[-0.7] text-foreground ${exposureTrial.className}`}
          >
            Lightfast Cloud Docs
          </h1>
          <p className="text-md text-muted-foreground leading-relaxed max-w-md">
            Build and deploy AI agents with the Lightfast Cloud platform.
            Everything you need to get started.
          </p>
        </div>
      </div>

      {/* Quickstart Section - Grid Layout */}
      <div className="section-gap-b">
        <div className="grid grid-cols-1 bg-card border border-border rounded-sm p-6 lg:grid-cols-12 gap-16">
          {/* Left Column: Description (5/12) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                Quickstart
              </p>
              <h3 className="text-3xl font-base leading-tight sm:text-3xl lg:text-2xl max-w-sm text-foreground">
                Make your first agent request in minutes
              </h3>
            </div>
            <div className="flex-1 flex items-center">
              <div className="space-y-6 -mt-8">
                <p className="text-sm text-muted-foreground max-w-sm">
                  Learn the basics of the Lightfast platform. Create, deploy,
                  and manage AI agents with our developer-friendly APIs.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Code Editor (7/12) */}
          <div className="lg:col-span-7 h-full">
            <CodeEditor />
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="section-gap-y">
        <div className="space-y-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
              <span>Products</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              Explore the Lightfast ecosystem
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {products.map((product) => (
              <Link
                key={product.name}
                href={product.href}
                className="group cursor-pointer block"
              >
                {/* Image Card */}
                <div className="relative h-64 rounded-sm mb-4 overflow-hidden transition-transform group-hover:scale-[1.02]">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Card Content */}
                <div className="space-y-2">
                  <h4 className="text-xl font-semibold text-foreground">
                    {product.title}
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {product.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
