import type React from "react";
import { Btn, EmptyStateLayout } from "./shared/empty-layout";
import { signalsScene } from "./shared/iso-figure";

export const SignalsEmpty: React.FC = () => (
  <EmptyStateLayout
    actions={
      <>
        <Btn kbd="C" primary>
          Create signal
        </Btn>
        <Btn>Documentation</Btn>
      </>
    }
    body="Signals is where every classified event from your API keys and automations lands. As soon as one is processed, it shows up here."
    fig="FIG 0.1"
    scene={signalsScene}
    title="No classified signals yet"
  />
);
