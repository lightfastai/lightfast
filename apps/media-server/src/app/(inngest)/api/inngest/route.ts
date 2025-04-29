import { createEventContext } from "@vendor/inngest/server";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import { handleCreateImage } from "~/app/(inngest)/api/inngest/_workflow/handle-create-image";
import { handleResourceImageSuccess } from "~/app/(inngest)/api/inngest/_workflow/handle-create-image-success";
import { handleCreateVideo } from "~/app/(inngest)/api/inngest/_workflow/handle-create-video";
import { handleResourceVideoSuccess } from "~/app/(inngest)/api/inngest/_workflow/handle-create-video-success";

export const maxDuration = 30;

export const { GET, POST, PUT } = createEventContext(inngest, [
  handleCreateImage,
  handleCreateVideo,
  handleResourceImageSuccess,
  handleResourceVideoSuccess,
]);
