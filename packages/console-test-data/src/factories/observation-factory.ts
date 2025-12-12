/**
 * Observation Factory
 *
 * Fluent builder API for generating test observations.
 *
 * @example
 * ```typescript
 * const factory = new ObservationFactory();
 *
 * // Generate 100 mixed observations
 * const observations = factory
 *   .withActors(['alice', 'bob', 'charlie'])
 *   .withDateRange(30) // Last 30 days
 *   .security(20)
 *   .performance(20)
 *   .bugfixes(20)
 *   .features(20)
 *   .devops(20)
 *   .build();
 *
 * // Generate custom observation
 * const custom = factory
 *   .custom({
 *     source: 'github',
 *     sourceType: 'pull-request.merged',
 *     title: 'Custom PR',
 *     body: 'Custom body',
 *   })
 *   .build();
 * ```
 */

import type { TestObservation, TestActor } from "../types";
import type { ObservationTemplate } from "./templates";
import { DEFAULT_ACTORS, getActor } from "./actors";
import {
  SECURITY_TEMPLATES,
  PERFORMANCE_TEMPLATES,
  BUGFIX_TEMPLATES,
  FEATURE_TEMPLATES,
  DEVOPS_TEMPLATES,
  DOCS_TEMPLATES,
} from "./templates";

export class ObservationFactory {
  private observations: TestObservation[] = [];
  private actors: TestActor[] = Object.values(DEFAULT_ACTORS);
  private dateRangeDays = 30;
  private sourceIdPrefix = "test";

  /**
   * Set actors to use for observations
   */
  withActors(actorNames: string[]): this {
    this.actors = actorNames.map(getActor);
    return this;
  }

  /**
   * Set date range for observations (days ago from now)
   */
  withDateRange(days: number): this {
    this.dateRangeDays = days;
    return this;
  }

  /**
   * Set source ID prefix for deduplication
   */
  withSourceIdPrefix(prefix: string): this {
    this.sourceIdPrefix = prefix;
    return this;
  }

  /**
   * Add security observations
   */
  security(count: number): this {
    this.addFromTemplates(SECURITY_TEMPLATES, count);
    return this;
  }

  /**
   * Add performance observations
   */
  performance(count: number): this {
    this.addFromTemplates(PERFORMANCE_TEMPLATES, count);
    return this;
  }

  /**
   * Add bug fix observations
   */
  bugfixes(count: number): this {
    this.addFromTemplates(BUGFIX_TEMPLATES, count);
    return this;
  }

  /**
   * Add feature observations
   */
  features(count: number): this {
    this.addFromTemplates(FEATURE_TEMPLATES, count);
    return this;
  }

  /**
   * Add devops observations
   */
  devops(count: number): this {
    this.addFromTemplates(DEVOPS_TEMPLATES, count);
    return this;
  }

  /**
   * Add documentation observations
   */
  docs(count: number): this {
    this.addFromTemplates(DOCS_TEMPLATES, count);
    return this;
  }

  /**
   * Add a custom observation
   */
  custom(template: Partial<ObservationTemplate> & { title: string; body: string }): this {
    const actor = this.randomActor();
    this.observations.push({
      source: template.source ?? "github",
      sourceType: template.sourceType ?? "push",
      title: template.title,
      body: template.body,
      actorName: actor.name,
      daysAgo: this.randomDaysAgo(),
      category: template.category ?? "custom",
      tags: template.tags ?? [],
    });
    return this;
  }

  /**
   * Add multiple custom observations
   */
  customBatch(
    templates: (Partial<ObservationTemplate> & { title: string; body: string })[]
  ): this {
    for (const template of templates) {
      this.custom(template);
    }
    return this;
  }

  /**
   * Generate a balanced mix of all categories
   */
  balanced(totalCount: number): this {
    const perCategory = Math.floor(totalCount / 6);
    const remainder = totalCount % 6;

    this.security(perCategory);
    this.performance(perCategory);
    this.bugfixes(perCategory);
    this.features(perCategory);
    this.devops(perCategory);
    this.docs(perCategory + remainder);

    return this;
  }

  /**
   * Build and return the observations
   */
  build(): TestObservation[] {
    const result = [...this.observations];
    this.observations = []; // Reset for next use
    return result;
  }

  /**
   * Build with shuffled order
   */
  buildShuffled(): TestObservation[] {
    const result = this.build();
    return result.sort(() => Math.random() - 0.5);
  }

  // Private helpers

  private addFromTemplates(templates: ObservationTemplate[], count: number): void {
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      if (!template) continue;
      const actor = this.randomActor();
      const daysAgo = this.randomDaysAgo();

      // Add variation to titles for uniqueness
      const titleVariation = count > templates.length ? ` (iteration ${Math.floor(i / templates.length) + 1})` : "";

      this.observations.push({
        source: template.source,
        sourceType: template.sourceType,
        title: template.title + titleVariation,
        body: template.body,
        actorName: actor.name,
        daysAgo,
        category: template.category,
        tags: template.tags,
      });
    }
  }

  private randomActor(): TestActor {
    const actor = this.actors[Math.floor(Math.random() * this.actors.length)];
    if (!actor) {
      throw new Error("No actors available");
    }
    return actor;
  }

  private randomDaysAgo(): number {
    return Math.floor(Math.random() * this.dateRangeDays) + 1;
  }
}

/**
 * Quick factory functions for common scenarios
 */
export const factory = {
  /**
   * Create a small test set (20 observations)
   */
  small(): TestObservation[] {
    return new ObservationFactory().balanced(20).buildShuffled();
  },

  /**
   * Create a medium test set (100 observations)
   */
  medium(): TestObservation[] {
    return new ObservationFactory().balanced(100).buildShuffled();
  },

  /**
   * Create a large test set (500 observations)
   */
  large(): TestObservation[] {
    return new ObservationFactory().balanced(500).buildShuffled();
  },

  /**
   * Create a stress test set (1000+ observations)
   */
  stress(count = 1000): TestObservation[] {
    return new ObservationFactory().balanced(count).buildShuffled();
  },

  /**
   * Create security-focused test set
   */
  securityFocused(count = 50): TestObservation[] {
    return new ObservationFactory()
      .security(Math.floor(count * 0.6))
      .bugfixes(Math.floor(count * 0.2))
      .features(Math.floor(count * 0.2))
      .buildShuffled();
  },

  /**
   * Create performance-focused test set
   */
  performanceFocused(count = 50): TestObservation[] {
    return new ObservationFactory()
      .performance(Math.floor(count * 0.6))
      .bugfixes(Math.floor(count * 0.2))
      .devops(Math.floor(count * 0.2))
      .buildShuffled();
  },
};
