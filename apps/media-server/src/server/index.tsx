import { Hono } from "hono";

import { inngestHandler } from "./inngest/v2/index";
import { renderer } from "./renderer";

const app = new Hono();

// Mount Inngest handler
app.use("/api/inngest", inngestHandler);

app.use(renderer);

app.get("/", (c) => {
  return c.render(
    <>
      <h1 className="text-3xl font-bold underline">Hello from SSR</h1>
      <div id="root"></div>
    </>,
  );
});

export default app;
