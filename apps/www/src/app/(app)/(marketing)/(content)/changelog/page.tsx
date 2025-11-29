import { exposureTrial } from "~/lib/fonts";
import { legal } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";

export const revalidate = 300;

export default async function ChangelogPage() {
  // Using the CMS "legal pages" as a placeholder for changelog entries.
  // Once a Changelog collection exists in BaseHub, we can switch queries.
  const entries = await legal.getPosts().catch(() => []);

  return (
    <>
      <h1
        className={`text-5xl font-light leading-[1.2] tracking-[-0.7] text-foreground mb-16 ${exposureTrial.className}`}
      >
        Changelog
      </h1>

      <div className="text-foreground divide-y divide-border">
        {entries.length === 0 ? (
          <div className="py-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-2 text-sm text-muted-foreground">
                —
              </div>
              <article className="md:col-span-6">
                <h2 className="text-2xl font-semibold mt-0 mb-4">Stay tuned</h2>
                <p className="text-foreground/80 leading-relaxed">
                  We’re shipping fast. Changelog entries will appear here after
                  our next release.
                </p>
              </article>
              <div className="hidden md:block md:col-span-4" />
            </div>
          </div>
        ) : (
          entries.map((item) => {
            const created = item._sys?.createdAt
              ? new Date(item._sys.createdAt)
              : null;
            const dateStr = created
              ? created.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "";
            return (
              <section key={item._slug ?? item._title} className="py-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                  <time className="md:col-span-2 text-sm text-muted-foreground leading-7 whitespace-nowrap">
                    {dateStr}
                  </time>
                  <article className="md:col-span-6">
                    <h2 className="text-3xl text-foreground font-semibold tracking-tight">
                      {item._title}
                    </h2>
                    {item.description ? (
                      <p className="mt-2 text-foreground leading-relaxed">
                        {item.description}
                      </p>
                    ) : null}
                    {item.body?.json?.content ? (
                      <div className="prose max-w-none mt-6 text-foreground">
                        <Body content={item.body.json.content} />
                      </div>
                    ) : null}
                    {item.body?.readingTime ? (
                      <div className="mt-4 text-xs text-muted-foreground">
                        {item.body.readingTime} min read
                      </div>
                    ) : null}
                  </article>
                  <div className="hidden md:block md:col-span-4" />
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
