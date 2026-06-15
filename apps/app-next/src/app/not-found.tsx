import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import {
  ErrorCode,
  LightfastErrorPage,
} from "@repo/ui/components/lightfast-error-page";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <LightfastCustomGridBackground.Root
      marginHorizontal="25vw"
      marginHorizontalMobile="10vw"
      marginVertical="25vh"
      marginVerticalMobile="25vh"
    >
      <LightfastCustomGridBackground.Container>
        <LightfastErrorPage
          code={ErrorCode.NotFound}
          description="Sorry, we couldn't find the page you're looking for."
        >
          <Button asChild>
            <Link href="/account/settings/general">Return Home</Link>
          </Button>
        </LightfastErrorPage>
      </LightfastCustomGridBackground.Container>
    </LightfastCustomGridBackground.Root>
  );
}
