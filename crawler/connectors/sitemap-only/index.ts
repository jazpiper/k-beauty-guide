import type { CrawlConnector, RawSnapshot } from "../../core/types";

function buildSitemapUrl(sourceBaseUrl: string): string {
  return `${sourceBaseUrl.replace(/\/$/, "")}/sitemap.xml`;
}

export const sitemapOnlyConnector: CrawlConnector = {
  sourceKey: "sitemap-only",

  getDefaultPolicy() {
    return {
      allowedPathPrefixes: ["/"],
      blockedPathPrefixes: [
        "/cart",
        "/checkout",
        "/account",
        "/order",
        "/search",
        "/filter",
        "/sort",
      ],
      maxRequestsPerMinute: 6,
      minDelayMs: 5000,
      maxPagesPerRun: 20,
      userAgentLabel: "k-beauty-guide-sitemap",
      pauseOnStatuses: [403, 429],
      pauseOnChallenge: true,
      snapshotRetentionDays: 30,
    };
  },

  async getDiscoveryTargets(context) {
    return context.sourceBaseUrl
      ? [
          {
            url: buildSitemapUrl(context.sourceBaseUrl),
            taskType: "discover_product_urls",
          },
        ]
      : [];
  },

  async parseDiscoverySnapshot(snapshot: RawSnapshot) {
    void snapshot;
    return [];
  },
};
