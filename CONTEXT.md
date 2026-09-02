# Context

## Company Direction Language

**Experimental Loop**:
An internal analytical lens Lightfast can use when work proceeds through bounded cycles of hypothesis, action, observation, interpretation, and a next step. It is not a universal description of research and development work or a public positioning term.
_Avoid_: Treating it as a required partner workflow or company-wide success metric

**Team–System Interaction**:
The working relationship between a team and the system it is researching or building, mediated by people, artificial intelligence, software, instruments, sensors, and machines. Lightfast aims to make this relationship more observable, steerable, and responsive.
_Avoid_: Experimental loop, as the universal description

**Human–Machine–Artificial Intelligence System**:
Lightfast's relational model for physical R&D: humans hold purpose, judgment, and responsibility; machines sense or act in the physical world; artificial intelligence provides connective intelligence that interprets context, translates between human intent and machine state, and supports coordination and adaptation.
_Avoid_: Using artificial intelligence as a synonym for machine, or making artificial intelligence the sole protagonist

**Company Descriptor**:
Lightfast is an applied artificial intelligence research and product lab.
_Avoid_: Applied AI lab, when the full term fits the public context

**Central Research Question**:
How should people and machines work together as scientific and engineering teams develop physical systems?
_Avoid_: Embedding an assumed industry failure or the entire partner-selection thesis in the question

**Consequential Partner Focus**:
Lightfast focuses its research on scientific and engineering teams developing physical technologies with credible potential to improve human life or expand civilization's ability to heal, perceive, build, and discover.
_Avoid_: Claiming that impact is guaranteed, or treating the impact frame as fixed product verticals

**Applied Research Cycle**:
Lightfast works alongside scientific and engineering teams, studies their real R&D environments, identifies a specific human–machine interaction to improve, and designs and tests possible systems with the team. What generalizes becomes Lightfast research, tooling, infrastructure, or products.
_Avoid_: Treating partner work as isolated consulting delivery

**Scientific and Engineering Team**:
The primary public subject for Lightfast: a team researching, designing, prototyping, building, testing, or maintaining a physical system. Its work may occur across laboratories, workshops, prototyping facilities, operating rooms, fabrication spaces, or field environments.
_Avoid_: Laboratory, when referring to the team itself

**Physical R&D Environment**:
The physical setting and connected tools through which a scientific and engineering team develops a system. A laboratory is one kind of physical R&D environment, not the universal form.
_Avoid_: Laboratory, as the umbrella term for every R&D setting

**Partner Objective**:
The domain outcome a partner pursues and the measures by which that partner judges success. Lightfast supports progress toward the objective but does not define or own it.
_Avoid_: Treating a Lightfast-wide metric as the partner's definition of success

**Heal, Perceive, Build, Discover**:
The working frame Lightfast uses to organize consequential physical R&D: heal includes therapeutic neurotechnology and medical devices; perceive includes optics, LiDAR, remote sensing, and scientific instrumentation; build includes robotics, machining, fabrication, and critical infrastructure; discover includes advanced laboratories, telescopes, and space-based research systems. These are areas of research interest, not four product commitments.
_Avoid_: Treating the frame as a fixed set of product verticals

## Domain Terms

### Website Repository Boundary

The public marketing website, its static publications, site identity, discovery policy, and copied `ui-v2` implementation are owned by [`lightfastai/www`](https://github.com/lightfastai/www).

This repository does not own the website deployment or its route mesh. Lightfast must not inspect or write the website repository through filesystem paths.

### Local Example and Client Boundary

`apps/example` is a local-only TanStack Start surface for exercising
`packages/ui-v2`. It has no production deployment or backend contract.

The public SDK, stdio MCP server, and CLI are configurable clients. They require
an explicit compatible backend URL and must not infer `https://lightfast.ai` as
an API or OAuth backend. `apps/desktop` is a repository-local static shell with
no backend configuration or production wiring. The public website URL remains
valid for marketing, documentation, metadata, and public links.
