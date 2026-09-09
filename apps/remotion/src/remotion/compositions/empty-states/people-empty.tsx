import type React from "react";
import { Btn, EmptyStateLayout } from "./shared/empty-layout";
import { peopleScene } from "./shared/iso-figure";

export const PeopleEmpty: React.FC = () => (
  <EmptyStateLayout
    actions={<Btn>Documentation</Btn>}
    body="People are discovered automatically as the signal pipeline processes events from email, GitHub, LinkedIn, and the web. They'll appear here as they're found."
    fig="FIG 0.2"
    scene={peopleScene}
    title="No people yet"
  />
);
