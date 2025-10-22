"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { ArrowRight, Loader2 } from "lucide-react";

const INQUIRY_TYPES = [
  { value: "consultation", label: "Considering Lightfast for consultation" },
  { value: "joining", label: "Considering joining Lightfast" },
  { value: "sales", label: "Considering a sales proposal to Lightfast" },
  { value: "other", label: "Others" },
] as const;

const REFERRAL_SOURCES = [
  { value: "internet", label: "Internet" },
  { value: "social", label: "Social Media" },
  { value: "media", label: "Media" },
  { value: "referral", label: "Referred by an acquaintance" },
] as const;

export function ContactFormAdvanced() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    familyName: "",
    email: "",
    phone: "",
    company: "",
    inquiryType: "",
    referralSource: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Implement form submission logic
    console.log("Form data:", formData);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    alert("Form submitted! (Placeholder - implement proper handling)");
  };

  return (
    <section
      id="contact-form"
      className="bg-background min-h-screen py-24 px-16 relative"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-24">
        {/* Left Column - Tagline */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <p className="text-foreground text-lg uppercase tracking-wider leading-relaxed">
              GET IN TOUCH, WE'RE
              <br />
              ALWAYS HAPPY TO HEAR
              <br />
              FROM YOU
            </p>
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="lg:col-span-2">
          <form
            id="contact-form-element"
            onSubmit={handleSubmit}
            className="space-y-12"
          >
            {/* Name - Split into two columns */}
            <div className="space-y-3">
              <Label htmlFor="firstName" className="text-foreground text-lg">
                Name<span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="firstName"
                  type="text"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                  variant="underline"
                  className="text-base md:text-lg"
                />
                <Input
                  type="text"
                  placeholder="Family Name"
                  value={formData.familyName}
                  onChange={(e) =>
                    setFormData({ ...formData, familyName: e.target.value })
                  }
                  variant="underline"
                  className="text-base md:text-lg"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-3">
              <Label htmlFor="email" className="text-foreground text-lg">
                Email Address<span className="text-destructive">*</span> (Please
                provide your business or school email address)
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="mail@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                variant="underline"
                className="text-base md:text-lg"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-3">
              <Label htmlFor="phone" className="text-foreground text-lg">
                Phone Number<span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="01234567890"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                required
                variant="underline"
                className="text-base md:text-lg"
              />
            </div>

            {/* Company Name */}
            <div className="space-y-3">
              <Label htmlFor="company" className="text-foreground text-lg">
                Company Name
              </Label>
              <Input
                id="company"
                type="text"
                placeholder="Your company"
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                variant="underline"
                className="text-base md:text-lg"
              />
            </div>

            {/* Inquiry Type - 2x2 Grid */}
            <div className="space-y-4">
              <Label className="text-foreground text-lg">
                Please select your reason for contacting us:
              </Label>
              <RadioGroup
                value={formData.inquiryType}
                onValueChange={(value) =>
                  setFormData({ ...formData, inquiryType: value })
                }
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {INQUIRY_TYPES.map((type) => (
                  <div key={type.value} className="flex items-center space-x-3">
                    <RadioGroupItem
                      value={type.value}
                      id={type.value}
                      className="border-border"
                    />
                    <Label
                      htmlFor={type.value}
                      className="text-foreground text-lg font-normal cursor-pointer"
                    >
                      {type.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Referral Source - Horizontal */}
            <div className="space-y-4">
              <Label className="text-foreground text-lg">
                How did you hear about Lightfast?
              </Label>
              <RadioGroup
                value={formData.referralSource}
                onValueChange={(value) =>
                  setFormData({ ...formData, referralSource: value })
                }
                className="flex flex-wrap gap-6"
              >
                {REFERRAL_SOURCES.map((source) => (
                  <div
                    key={source.value}
                    className="flex items-center space-x-3"
                  >
                    <RadioGroupItem
                      value={source.value}
                      id={source.value}
                      className="border-border"
                    />
                    <Label
                      htmlFor={source.value}
                      className="text-foreground text-lg font-normal cursor-pointer"
                    >
                      {source.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Message */}
            <div className="space-y-3">
              <Label htmlFor="message" className="text-foreground text-lg">
                Inquiry<span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="message"
                placeholder="Your message"
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                required
                className="min-h-[200px] text-base md:text-lg text-foreground placeholder:text-foreground/50 border-0 border border-foreground/20 px-3 py-3 rounded-none dark:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-foreground"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Floating Submit Button */}
      <Button
        type="submit"
        form="contact-form-element"
        disabled={isSubmitting}
        size="lg"
        className="fixed bottom-8 right-8 z-50 h-14 px-8 rounded-full bg-gradient-to-r from-orange-500 to-teal-500 hover:from-orange-600 hover:to-teal-600 text-primary-foreground text-sm shadow-lg hover:shadow-xl transition-all"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-5 animate-spin mr-2" />
            Sending...
          </>
        ) : (
          <>
            Submit
            <ArrowRight className="size-5 ml-2" />
          </>
        )}
      </Button>
    </section>
  );
}
