import type { Metadata } from "next";
import { ContactSection } from "~/components/landing/contact-section";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Lightfast. Whether you're looking to scale your team, integrate your tools, or build AI-native workflows, we'd love to hear from you.",
};

export default function ContactPage() {
  return (
    <div className="relative dark">
      <ContactSection />
    </div>
  );
}
