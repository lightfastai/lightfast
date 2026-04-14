import Image from "next/image";

export function IntegrationScreenshot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className="my-10">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/50 bg-card">
        <Image
          alt={alt}
          className="h-full w-full object-cover"
          fill
          src={src}
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-muted-foreground text-sm">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
