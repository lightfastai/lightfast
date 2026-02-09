import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export interface EmbeddingCacheEntry {
  text: string;
  embedding: number[];
}

/**
 * Cache pre-computed embeddings keyed by corpus content hash.
 * Avoids redundant Cohere API calls on repeated seeding runs.
 */
export class EmbeddingCache {
  private cacheDir: string;
  private entries: Map<string, number[]> = new Map();
  private cacheFile: string;

  constructor(cacheDir: string, corpusHash: string) {
    this.cacheDir = cacheDir;
    this.cacheFile = join(cacheDir, `embeddings-${corpusHash}.json`);
    this.load();
  }

  static hashCorpus(corpusJson: string): string {
    return createHash("sha256").update(corpusJson).digest("hex").slice(0, 16);
  }

  has(text: string): boolean {
    return this.entries.has(this.hashText(text));
  }

  get(text: string): number[] | undefined {
    return this.entries.get(this.hashText(text));
  }

  set(text: string, embedding: number[]): void {
    this.entries.set(this.hashText(text), embedding);
  }

  save(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
    const data: EmbeddingCacheEntry[] = [];
    for (const [hash, embedding] of this.entries) {
      data.push({ text: hash, embedding });
    }
    writeFileSync(this.cacheFile, JSON.stringify(data));
  }

  get size(): number {
    return this.entries.size;
  }

  private load(): void {
    if (!existsSync(this.cacheFile)) return;
    try {
      const data: EmbeddingCacheEntry[] = JSON.parse(readFileSync(this.cacheFile, "utf-8"));
      for (const entry of data) {
        this.entries.set(entry.text, entry.embedding);
      }
    } catch {
      // Corrupted cache — start fresh
    }
  }

  private hashText(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 32);
  }
}
