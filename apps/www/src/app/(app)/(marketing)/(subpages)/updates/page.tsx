import { localFont } from "next/font/local";

const exposureTrial = localFont({
  src: "../../../../../../public/fonts/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
});

export default function UpdatesPage() {
  return (
    <>
      <div className="container mx-auto px-16 py-24">
      <div className="max-w-4xl mx-auto">
        <h1
          className={`text-6xl font-light leading-[1.2] tracking-[-0.7] text-foreground mb-8 ${exposureTrial.className}`}
        >
          Updates
        </h1>

        <div className="space-y-12 text-foreground">
          <article className="border-l-2 border-border pl-8 py-4">
            <time className="text-sm text-muted-foreground">Coming Soon</time>
            <h2 className="text-2xl font-semibold mt-2 mb-4">Stay Tuned</h2>
            <p className="text-foreground/80 leading-relaxed">
              We're working on building something incredible. Updates and
              announcements will appear here as we progress.
            </p>
          </article>
        </div>
      </div>
      </div>
    </>
  );
}
