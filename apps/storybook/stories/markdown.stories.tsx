import { markdownComponents } from "@repo/ui-v2/components/content/markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";

const {
  a: Anchor,
  blockquote: Blockquote,
  code: Code,
  em: Em,
  h1: H1,
  h2: H2,
  h3: H3,
  hr: Hr,
  li: Li,
  ol: Ol,
  p: Paragraph,
  strong: Strong,
  table: Table,
  tbody: Tbody,
  td: Td,
  th: Th,
  thead: Thead,
  tr: Tr,
  ul: Ul,
} = markdownComponents;

function MarkdownSpecimen() {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <H1>Agent Runtime Notes</H1>
      <Paragraph>
        Lightfast programs coordinate agents, tools, and long-running work
        without turning the workspace into a maze. The prose layer should make
        dense docs feel calm, searchable, and easy to scan.
      </Paragraph>
      <Paragraph>
        Inline elements include{" "}
        <Anchor href="https://lightfast.ai">external links</Anchor>,{" "}
        <Strong>strong emphasis</Strong>, <Em>emphasis</Em>, and{" "}
        <Code>inlineCode()</Code>.
      </Paragraph>

      <H2>Design Goals</H2>
      <Paragraph>
        A runtime note often moves between product principles and operational
        details. It needs enough contrast for scanning, but not so much styling
        that every paragraph starts asking for attention.
      </Paragraph>
      <Ul>
        <Li>Keep paragraphs narrow enough for sustained reading.</Li>
        <Li>Make section changes obvious without breaking the flow.</Li>
        <Li>Let dense reference tables survive small screens.</Li>
      </Ul>

      <H3>Ordered Steps</H3>
      <Ol>
        <Li>Describe the decision in plain language.</Li>
        <Li>Show the operational impact close to the claim.</Li>
        <Li>Leave enough structure for future readers to return quickly.</Li>
      </Ol>

      <Blockquote>
        <Paragraph>
          Interfaces for reading should feel quiet, deliberate, and almost
          invisible once the content starts doing its work.
        </Paragraph>
      </Blockquote>

      <Hr />

      <Table>
        <Thead>
          <Tr>
            <Th>Area</Th>
            <Th>Purpose</Th>
            <Th>Reader cue</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td>Programs</Td>
            <Td>Long-running work</Td>
            <Td>Tracked across handoffs</Td>
          </Tr>
          <Tr>
            <Td>Tools</Td>
            <Td>Workspace actions</Td>
            <Td>Scoped to the active task</Td>
          </Tr>
          <Tr>
            <Td>Memory</Td>
            <Td>Project context</Td>
            <Td>Recovered when the thread resumes</Td>
          </Tr>
        </Tbody>
      </Table>
    </article>
  );
}

const meta = {
  title: "content/Markdown",
  component: MarkdownSpecimen,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof MarkdownSpecimen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
