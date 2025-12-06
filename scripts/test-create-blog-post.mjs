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
    },
  });

  const authors = queryResult.blog.author.items ?? [];
  const categories = queryResult.blog.categories.items ?? [];

  console.log("blog.author.items:", authors);
  console.log("blog.categories.items:", categories);

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
        data: {
          type: "create",
          _table: "blog.post",
          _title: title,
          slug,
          description,
          body: {
            type: "rich-text",
            markdown: content,
          },
          excerpt: {
            type: "rich-text",
            markdown: excerpt,
          },
          // SeoComponent
          seo: {
            focusKeyword: "ai blog test",
            secondaryKeywords: "lightfast blog, basehub, claude code",
            metaDescription: description.slice(0, 160),
            metaTitle: title,
            canonicalUrl: `https://example.com/blog/${slug}`,
            noIndex: false,
          },
          // DistributionComponent
          distribution: {
            businessGoal: "awareness",
            primaryProductArea: "Lightfast Core",
            targetPersona: "IC engineers",
            campaignTag: "test-ai-blog-workflow",
            distributionChannels: "blog, newsletter",
          },
          // EngagementComponent
          engagement: {
            ctaType: "newsletter",
            ctaTitle: "Stay in the loop",
            ctaButtonText: "Subscribe",
            ctaButtonUrl: "https://example.com/newsletter",
            ctaDescription: {
              type: "rich-text",
              markdown: "Subscribe to get updates on our AI content workflows.",
            },
          },
          status: "draft",
          publishedAt: {
            type: "date",
            value: now,
          },
          contentType: "tutorial",
          author: {
            type: "reference",
            ids: [authorId],
          },
          categories: {
            type: "reference",
            ids: [categoryId],
          },
        },
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
