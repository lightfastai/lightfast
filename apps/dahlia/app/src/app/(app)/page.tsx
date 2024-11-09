import Image from "next/image";

import { Card } from "@repo/ui/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@repo/ui/components/ui/carousel";

import { AuthWrapper } from "~/components/auth-wrapper";
import { TextureGenerationForm } from "~/components/texture-generation-form";

export default function Page() {
  return (
    <>
      <AuthWrapper />
      <main
        className="relative mx-auto flex min-h-screen w-full flex-col items-center justify-center px-4 pb-20 sm:max-w-4xl sm:px-0 sm:pb-32"
        aria-label="Main content"
      >
        <div className="flex h-[30vh] w-full flex-col items-center justify-center gap-6 sm:h-[40vh] sm:gap-12">
          <h1 className="text-balance px-4 text-center text-xl font-bold sm:text-2xl">
            What can I help you create?
          </h1>
          <TextureGenerationForm />
        </div>

        <div className="flex w-full flex-col items-start gap-4 px-4 sm:gap-6 sm:px-0">
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
                  <Card className="relative h-[400px] w-full overflow-hidden rounded-[0.25rem] transition-transform duration-300 hover:scale-[1.02] sm:h-[300px]">
                    <Image
                      src={`/playground-placeholder-${id}.webp`}
                      alt={`Template preview ${id}`}
                      width={1000}
                      height={1000}
                      className="h-full w-full object-cover"
                    />
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="block">
              <CarouselPrevious
                className="left-4"
                aria-label="View previous template"
              />
              <CarouselNext
                className="right-4"
                aria-label="View next template"
              />
            </div>
          </Carousel>
        </div>
      </main>
    </>
  );
}
