import { Logo } from "@repo/ui-v2/components/brand/logo";
import { Input } from "@repo/ui-v2/components/ui/input";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

const meta = {
  title: "Brand/Typography",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const labelClassName =
  "font-mono text-xs uppercase leading-[18px] tracking-normal text-muted-foreground";

const typeRows = [
  {
    label: "Title",
    className:
      "font-title text-[64px] font-medium leading-[70px] tracking-[-0.03em]",
    text: "PP Neue Montreal",
  },
  {
    label: "Hero",
    className:
      "font-title text-[42px] font-medium leading-[46px] tracking-[-0.03em]",
    text: "A git forge for the agentic era",
  },
  {
    label: "Interface",
    className: "font-sans text-base font-normal leading-6 tracking-normal",
    text: "Geist is the default interface font for body, controls, labels, tables, and product UI.",
  },
  {
    label: "Mono",
    className:
      "font-mono text-xs uppercase leading-5 tracking-normal text-foreground",
    text: "lightfast.ai / production surface",
  },
] as const;

export const TypeScale: Story = {
  render: () => (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-10">
      <div className="flex items-start justify-between gap-8 border-b pb-8">
        <div className="flex flex-col gap-2">
          <p className={labelClassName}>brand typography</p>
          <h1 className="font-medium font-title text-4xl leading-10 tracking-[-0.03em]">
            PP titles, Geist interface
          </h1>
        </div>
        <Logo size="sm" />
      </div>
      <div className="flex flex-col gap-8">
        {typeRows.map((row) => (
          <div
            className="grid grid-cols-[140px_1fr] items-baseline gap-8 border-b pb-8"
            key={row.label}
          >
            <span className={labelClassName}>{row.label}</span>
            <p className={row.className}>{row.text}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const LandingExample: Story = {
  render: () => (
    <div className="flex min-h-[calc(100vh_-_48px)] items-center justify-center bg-background">
      <div className="relative h-[min(720px,calc(100vh_-_48px))] w-full max-w-[1180px] overflow-hidden rounded-lg bg-[#090909] text-[#edecec]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[length:6px_6px] bg-[radial-gradient(circle_at_center,rgba(237,236,236,0.72)_0_1px,transparent_1.5px)] opacity-[0.22]"
        />
        <div
          aria-hidden="true"
          className="absolute top-14 -left-20 size-[620px] rounded-full border border-white/35"
        />
        <div
          aria-hidden="true"
          className="absolute top-[190px] left-0 h-px w-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute top-0 left-[250px] h-full w-px bg-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute top-[260px] -right-24 h-px w-[540px] rotate-[-35deg] bg-white/70"
        />
        <section className="relative z-10 ml-[250px] flex h-full max-w-[560px] flex-col justify-center">
          <Logo className="mb-10" size="md" variant="inverse" />
          <h1 className="max-w-[520px] font-medium font-title text-[52px] leading-[57px] tracking-[-0.03em]">
            A git forge for the agentic era
          </h1>
          <p className="mt-5 max-w-[520px] font-sans text-base text-white/80 leading-6 tracking-normal">
            Code is moving faster than any infrastructure was built to handle.
            Origin was designed for this moment.
          </p>
          <label
            className="mt-10 mb-3 font-sans text-sm text-white/85 leading-5"
            htmlFor="landing-example-email"
          >
            Join the waitlist
          </label>
          <Input
            className="h-12 w-[560px] border-white/20 bg-white text-black"
            id="landing-example-email"
            placeholder="Enter your work email"
            type="email"
          />
        </section>
      </div>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", {
        name: /a git forge for the agentic era/i,
      })
    ).toBeTruthy();
    await expect(
      canvas.getByPlaceholderText(/enter your work email/i)
    ).toBeTruthy();
  },
};
