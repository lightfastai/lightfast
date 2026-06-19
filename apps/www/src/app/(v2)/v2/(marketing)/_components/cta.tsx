export function Cta() {
  return (
    <section className="px-6 py-28 text-center sm:px-10 md:py-36">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-medium font-title text-4xl tracking-normal sm:text-5xl">
          Sign up to stay updated
        </h2>
        <p className="mx-auto mt-10 max-w-xl text-base leading-7 text-muted-foreground">
          We will be sharing more notes on building with agents soon. To stay
          updated, please sign up.
        </p>
        <form className="mx-auto mt-12 max-w-xl text-left">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="v2-updates-email">
              Email
            </label>
            <input
              className="h-10 flex-1 border border-border bg-transparent px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
              id="v2-updates-email"
              name="email"
              placeholder="Email*"
              type="email"
            />
            <button
              className="inline-flex h-10 items-center justify-center gap-2 text-muted-foreground text-xl transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
              type="submit"
            >
              Sign up <span aria-hidden="true">→</span>
            </button>
          </div>
          <label
            className="mt-10 grid grid-cols-[1.25rem_1fr] gap-4 text-muted-foreground text-sm leading-6"
            htmlFor="v2-updates-consent"
          >
            <input
              className="mt-1 size-5 appearance-none rounded-[3px] border border-border bg-transparent checked:bg-primary"
              id="v2-updates-consent"
              name="updates"
              type="checkbox"
            />
            <span>
              I would like to receive updates from Lightfast about product
              notes, research, events, and announcements.
            </span>
          </label>
        </form>
      </div>
    </section>
  );
}
