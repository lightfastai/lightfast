import { DeusApiService } from "./base-service";

export class CodeReviewsService extends DeusApiService {
  /**
   * Find reviews by repository and PR ID (for webhooks)
   */
  async findByRepositoryAndPrId(repositoryId: string, githubPrId: string) {
    return await this.call(
      "codeReview.findByRepositoryAndPrId",
      (caller) => caller.codeReview.findByRepositoryAndPrId({ repositoryId, githubPrId }),
      {
        fallbackMessage: "Failed to find code reviews",
        details: { repositoryId, githubPrId },
      },
    );
  }

  /**
   * Update metadata for multiple reviews (for webhooks)
   */
  async updateMetadataBatch(reviews: Array<{ id: string; metadata: Record<string, unknown> }>) {
    return await this.call(
      "codeReview.updateMetadataBatch",
      (caller) => caller.codeReview.updateMetadataBatch(reviews),
      {
        fallbackMessage: "Failed to update code review metadata",
        details: { count: reviews.length },
      },
    );
  }
}
