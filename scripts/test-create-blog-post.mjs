import basehubPkg from "../vendor/cms/node_modules/basehub/dist/index.cjs";

const { basehub } = basehubPkg;

async function main() {
  const token = process.env.BASEHUB_ADMIN_TOKEN;
  if (!token) {
    throw new Error("BASEHUB_ADMIN_TOKEN is not set in the environment");
  }

  const client = basehub({ token });

  // 1. Fetch at least one author and one category from the blog schema
  const queryResult = await client.query({
    blog: {
      author: {
        items: {
          _id: true,
          _title: true,
        },
      },
      categories: {
        items: {
          _id: true,
          _title: true,
        },
      },
      post: {
        _id: true, // Get the collection ID for parentId
      },
    },
  });

  const authors = queryResult.blog.author.items ?? [];
  const categories = queryResult.blog.categories.items ?? [];
  const postCollectionId = queryResult.blog.post._id;

  console.log("blog.author.items:", authors);
  console.log("blog.categories.items:", categories);
  console.log("blog.post collection ID:", postCollectionId);

  if (authors.length === 0) {
    throw new Error("No authors found in blog.author.items – create one in Basehub first.");
  }
  if (categories.length === 0) {
    throw new Error("No categories found in blog.categories.items – create one in Basehub first.");
  }

  const authorId = authors[0]._id;
  const categoryId = categories[0]._id;

  const now = new Date().toISOString();

  const title = "Test AI Blog Post (workflow smoke test)";
  const slug = "test-ai-blog-post-workflow-smoke-test";
  const description =
    "Testing the AI-first blog workflow integration between Claude Code, cms-workflows, and Basehub.";
  const excerpt =
    "This is a test excerpt for an AI-generated blog post created via the Basehub transaction API.";
  const content = `# ${title}

This post was created via a scripted transaction to validate the updated blog schema.

- Uses the new \`blog.post\` list
- Populates seo, distribution, and engagement components
- Links a real author and category from Basehub
`;

  // 2. Run a transaction to create a new PostItem in blog.post
  const mutationResult = await client.mutation({
    transaction: {
      __args: {
        autoCommit: `AI: Test blog post - ${title}`,
        data: [{
          type: "create",
          parentId: postCollectionId,
          data: {
            type: "instance",
            title: title,
            value: {
              slug: { type: "text", value: slug },
              description: { type: "text", value: description },
              body: {
                type: "rich-text",
                value: { format: "markdown", value: content },
              },
              excerpt: {
                type: "rich-text",
                value: { format: "markdown", value: excerpt },
              },
              // SeoComponent
              seo: {
                type: "instance",
                value: {
                  focusKeyword: { type: "text", value: "ai blog test" },
                  secondaryKeywords: { type: "text", value: "lightfast blog, basehub, claude code" },
                  metaDescription: { type: "text", value: description.slice(0, 160) },
                  metaTitle: { type: "text", value: title },
                  canonicalUrl: { type: "text", value: `https://example.com/blog/${slug}` },
                  noIndex: { type: "boolean", value: false },
                },
              },
              // DistributionComponent
              distribution: {
                type: "instance",
                value: {
                  businessGoal: { type: "select", value: "awareness" },
                  primaryProductArea: { type: "text", value: "Lightfast Core" },
                  targetPersona: { type: "text", value: "IC engineers" },
                  campaignTag: { type: "text", value: "test-ai-blog-workflow" },
                  distributionChannels: { type: "text", value: "blog, newsletter" },
                },
              },
              // EngagementComponent
              engagement: {
                type: "instance",
                value: {
                  ctaType: { type: "select", value: "newsletter" },
                  ctaTitle: { type: "text", value: "Stay in the loop" },
                  ctaButtonText: { type: "text", value: "Subscribe" },
                  ctaButtonUrl: { type: "text", value: "https://example.com/newsletter" },
                  ctaDescription: {
                    type: "rich-text",
                    value: { format: "markdown", value: "Subscribe to get updates on our AI content workflows." },
                  },
                },
              },
              status: { type: "select", value: "draft" },
              publishedAt: { type: "date", value: now },
              contentType: { type: "select", value: "tutorial" },
              authors: { type: "reference", value: [authorId] },
              categories: { type: "reference", value: [categoryId] },
            },
          },
        }],
      },
      message: true,
      status: true,
    },
  });

  console.log("Blog post mutation result:");
  console.log(JSON.stringify(mutationResult, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
