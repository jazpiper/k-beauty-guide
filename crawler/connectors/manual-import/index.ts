import { scoreCandidate } from "../../core/confidenceScorer";
import type {
  CrawlConnector,
  ProductCandidate,
  RawSnapshot,
} from "../../core/types";

export const manualImportConnector: CrawlConnector = {
  sourceKey: "manual-import",

  getDefaultPolicy() {
    return {
      allowedPathPrefixes: [],
      blockedPathPrefixes: [],
      maxRequestsPerMinute: 0,
      minDelayMs: 0,
      maxPagesPerRun: 0,
      userAgentLabel: "k-beauty-guide-manual-import",
      pauseOnStatuses: [],
      pauseOnChallenge: false,
      snapshotRetentionDays: 30,
    };
  },

  async getDiscoveryTargets() {
    return [];
  },

  async parseDiscoverySnapshot() {
    return [];
  },

  async parseProductCandidate(snapshot: RawSnapshot): Promise<ProductCandidate> {
    const candidateWithoutScore: Omit<ProductCandidate, "confidenceScore"> = {
      sourceId: snapshot.sourceId,
      snapshotId: snapshot.id,
      sourceUrl: snapshot.targetUrl,
      productName: "Manual import candidate",
      imageUrls: [],
      claims: [],
      parserVersion: "manual-import@0.1.0",
      confidenceHints: [
        {
          field: "brandName",
          reasonCode: "missing",
          message: "Manual import shell does not parse brand data yet.",
        },
        {
          field: "ingredientTextRaw",
          reasonCode: "missing",
          message: "Manual import shell does not parse ingredient text yet.",
        },
      ],
    };

    return {
      ...candidateWithoutScore,
      confidenceScore: scoreCandidate(candidateWithoutScore),
    };
  },
};
