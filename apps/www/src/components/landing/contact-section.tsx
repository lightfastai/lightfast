import { ContactHero } from "./contact-hero";
import { ContactFormAdvanced } from "./contact-form-advanced";

/**
 * ContactSection - Full contact page layout
 *
 * Structure:
 * 1. Hero section: Full-width gradient with large "contact" text
 * 2. Form section: Black background with 30/70 split layout
 */
export function ContactSection() {
  return (
    <>
      <ContactHero />
      <ContactFormAdvanced />
    </>
  );
}
