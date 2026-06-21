import Image from "next/image";

interface LandingProps {
  title: string;
  description?: string;
  featuredImage?: string;
  tldr?: string;
}

export function Landing({
  title,
  description,
  featuredImage,
  tldr,
}: LandingProps) {
  return (
    <section className="px-6 pt-32 pb-12 sm:px-10 sm:pt-36 md:pb-16">
      <div className="space-y-16">
        <div className="mx-auto w-full max-w-2xl space-y-4 text-center">
          <h1 className="font-medium font-title text-4xl text-foreground tracking-normal">
            {title}
          </h1>
          {description && (
            <p className="text-foreground text-md leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {featuredImage && (
          <div className="mx-auto w-full max-w-[1080px]">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-card">
              <Image
                alt={title}
                className="h-full w-full object-cover"
                fill
                fetchPriority="high"
                preload
                quality={40}
                sizes="(max-width: 640px) calc(100vw - 3rem), (max-width: 1024px) calc(100vw - 5rem), 1440px"
                src={featuredImage}
              />
            </div>
          </div>
        )}

        {tldr && (
          <div className="mx-auto w-full max-w-2xl rounded-xs border bg-background p-8">
            <h2 className="mb-4 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              TL;DR
            </h2>
            <p className="text-foreground text-sm leading-relaxed">{tldr}</p>
          </div>
        )}
      </div>
    </section>
  );
}
