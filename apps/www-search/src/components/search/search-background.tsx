import Image from "next/image";

export function SearchBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 mx-64 my-32 pointer-events-none"
    >
      {/* Background image, blurred and slightly scaled to avoid edge artifacts */}
      <Image
        src="/images/blue-sky.webp"
        alt=""
        fill
        priority
        unoptimized
        className="object-cover scale-110 blur-3xl"
      />
    </div>
  );
}
