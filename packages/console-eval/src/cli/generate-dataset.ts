import { generateCorpus } from "../generation/corpus-generator";
import { generateQueries } from "../generation/query-generator";
import { scoreQuery, filterByCriticScores } from "../generation/critic";
import { annotateWithGroundTruth } from "../generation/ground-truth";
import { EvalDatasetSchema, type EvalDataset } from "../datasets/schema";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main dataset generation pipeline
 */
async function main() {
  console.log("Phase 1: Generate deterministic corpus");
  const corpus = generateCorpus();

  // Convert to simplified format for LLM prompt
  const corpusForPrompt = [
    ...corpus.pushes.map(p => ({
      id: `push:${p.repository.full_name}:${p.after}`,
      title: p.head_commit?.message.split("\n")[0] || `Push to ${p.ref}`,
      description: `Push to ${p.repository.full_name} by ${p.pusher.name}: ${p.commits.map((c: any) => c.message).join(", ")}`,
    })),
    ...corpus.prs.map(pr => ({
      id: `pr:${pr.pull_request.id}`,
      title: pr.pull_request.title,
      description: pr.pull_request.body || "",
    })),
    ...corpus.errors.map(e => ({
      id: `error:${e.data.event.event_id}`,
      title: e.data.event.message,
      description: `${e.data.event.level} in ${e.data.event.project}`,
    })),
  ];

  console.log(`Corpus: ${corpusForPrompt.length} events`);

  console.log("\nPhase 2: Generate queries with LLM");
  const generatedQueries = await generateQueries(corpusForPrompt, 60);
  console.log(`Generated: ${generatedQueries.length} queries`);

  console.log("\nPhase 3: Score with critic LLM");
  const scoredQueries: Array<{
    query: string;
    queryType: string;
    expectedEventIds: string[];
    complexity: string;
    reasoning: string;
    criticScore: any;
  }> = [];
  for (const q of generatedQueries) {
    console.log(`Scoring query: "${q.query.substring(0, 50)}..."`);
    const score = await scoreQuery(q.query, q.expectedEventIds, corpusForPrompt);
    scoredQueries.push({ ...q, criticScore: score });
  }

  const filtered = filterByCriticScores(
    scoredQueries.map(q => ({ query: q.query, score: q.criticScore })),
    3 // Min score
  );
  console.log(`After filtering: ${filtered.length} queries (score ≥3)`);

  console.log("\nPhase 4: Annotate with ground truth");
  const EVAL_WORKSPACE_ID = process.env.EVAL_WORKSPACE_ID;
  if (!EVAL_WORKSPACE_ID) {
    throw new Error("EVAL_WORKSPACE_ID not set");
  }

  const annotated = await annotateWithGroundTruth(
    filtered.map(f => ({
      query: f.query,
      expectedEventIds: scoredQueries.find(sq => sq.query === f.query)!.expectedEventIds,
    })),
    EVAL_WORKSPACE_ID
  );

  // Filter out queries with missing ground truth
  const complete = annotated.filter(a => a.missingIds.length === 0);
  console.log(`With complete ground truth: ${complete.length} queries`);

  if (complete.length < 50) {
    console.warn(`Warning: Only ${complete.length} queries with complete ground truth (target: 50)`);
    console.warn(`Missing IDs for incomplete queries:`, annotated.filter(a => a.missingIds.length > 0).map(a => a.missingIds));
  }

  console.log("\nPhase 5: Build dataset");
  const dataset: EvalDataset = {
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    description: "Golden evaluation dataset v1 - LLM-generated with critic filtering",
    workspaceId: EVAL_WORKSPACE_ID,
    cases: complete.slice(0, 50).map((q, i) => {
      const original = scoredQueries.find(sq => sq.query === q.query)!;
      return {
        id: `golden-${String(i + 1).padStart(3, "0")}`,
        query: q.query,
        queryType: original.queryType as any,
        expectedObservationIds: q.expectedObservationIds,
        complexity: original.complexity as any,
        source: "synthetic" as const,
        annotator: "llm",
        notes: original.reasoning,
      };
    }),
  };

  // Validate
  EvalDatasetSchema.parse(dataset);

  // Write to file
  const outPath = join(__dirname, "../datasets/golden-v1.json");
  writeFileSync(outPath, JSON.stringify(dataset, null, 2));
  console.log(`\nDataset written to: ${outPath}`);
  console.log(`Total cases: ${dataset.cases.length}`);
}

main().catch(console.error);
