import Image from "next/image";

import { Card } from "@repo/ui/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@repo/ui/components/ui/carousel";

import { AuthLoginSignupRedirect } from "~/components/auth-login-signup-redirect";
import { TextureGenerationForm } from "~/components/texture-generation-form";

export default function Page() {
  return (
    <>
      <AuthLoginSignupRedirect />
      <main
        className="relative mx-auto flex min-h-screen w-full flex-col items-center justify-center px-6 pb-20 sm:max-w-4xl sm:px-8 sm:pb-32 lg:px-12"
        aria-label="Main content"
      >
        <div className="flex h-[30vh] w-full flex-col items-center justify-center gap-6 sm:h-[30vh] sm:gap-12">
          <h1 className="text-balance px-4 text-center text-xl font-bold sm:text-2xl">
            What can I help you create?
          </h1>
          <TextureGenerationForm />
        </div>

        <div className="flex w-full flex-col items-start gap-4 px-0 sm:gap-6">
          <h2 className="text-balance text-left text-xl leading-6 text-primary sm:text-2xl">
            Or start with a template
          </h2>

          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
            aria-label="Template gallery"
          >
            <CarouselContent className="-ml-2 sm:-ml-4">
              {[1, 2, 3].map((id) => (
                <CarouselItem
                  key={id}
                  className="pl-2 sm:pl-4 md:basis-1/2"
                  role="group"
                  aria-label={`Template ${id}`}
                >
                  <Card className="relative h-[400px] w-full overflow-hidden rounded-lg transition-transform duration-300 hover:scale-[1.02] sm:h-[300px]">
                    <Image
                      src={`/playground-placeholder-${id}.webp`}
                      alt={`Template preview ${id}`}
                      width={800}
                      height={600}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      quality={70}
                      priority={id === 1}
                      className="h-full w-full object-cover"
                    />
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="block">
              <CarouselPrevious
                className="left-6 lg:left-8"
                aria-label="View previous template"
              />
              <CarouselNext
                className="right-6 lg:right-8"
                aria-label="View next template"
              />
            </div>
          </Carousel>
        </div>
      </main>
    </>
  );
}
