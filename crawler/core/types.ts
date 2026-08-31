export type CrawlContext = {
  sourceId: string;
  sourceKey: string;
  sourceBaseUrl?: string;
  now: string;
};

export type DiscoveredUrl = {
  url: string;
  sourceProductId?: string;
  lastModified?: string;
};

export type DiscoveryTarget = {
  url: string;
  taskType: "discover_product_urls";
};

export type SourceCrawlPolicy = {
  allowedPathPrefixes: string[];
  blockedPathPrefixes: string[];
  maxRequestsPerMinute: number;
  minDelayMs: number;
  maxPagesPerRun: number;
  userAgentLabel: string;
  pauseOnStatuses: number[];
  pauseOnChallenge: boolean;
  snapshotRetentionDays: number;
};

export type ConfidenceHint = {
  field:
    | "brandName"
    | "productName"
    | "category"
    | "ingredientTextRaw"
    | "imageUrls"
    | "price";
  reasonCode: "missing" | "weak_match" | "conflict" | "parser_fallback";
  message: string;
};

export type RawSnapshot = {
  id: string;
  sourceId: string;
  targetUrl: string;
  contentType: "html" | "json" | "text" | "image";
  contentHash: string;
  storagePath: string;
  fetchedAt: string;
};

export type ProductImageCandidate = {
  url: string;
  source: "json_ld" | "open_graph" | "shopify_product_json" | "dom_selector";
  selector?: string;
  sourceEvidence?: string;
  candidateRole?: "primary" | "gallery" | "swatch" | "unknown";
  altText?: string;
  width?: number;
  height?: number;
  position?: number;
  contentType?: string;
  reviewStatus?: "needs_review" | "rejected" | "approved";
  imageStoragePolicy?: "remote_url_only";
  confidence?: number;
};

export type ProductTextCandidate = {
  text: string;
  source: "json_ld" | "open_graph" | "shopify_product_json" | "dom_selector";
  selector?: string;
  sourceEvidence?: string;
  fieldType?: "description" | "benefit" | "claim" | "how_to_use" | "unknown";
  riskFlags?: string[];
  reviewStatus?: "needs_review" | "rejected" | "approved";
  confidence?: number;
};

export type ProductCandidate = {
  sourceId: string;
  snapshotId: string;
  sourceProductId?: string;
  sourceUrl: string;
  brandName?: string;
  productName: string;
  category?: string;
  sourcePrice?: number;
  sourceCurrency?: string;
  priceKrw?: number;
  imageUrls: string[];
  imageCandidates?: ProductImageCandidate[];
  description?: string;
  descriptionCandidates?: ProductTextCandidate[];
  claims: string[];
  claimRiskFlags?: string[];
  ingredientTextRaw?: string;
  parserVersion: string;
  confidenceHints: ConfidenceHint[];
  confidenceScore: number;
};

export type CrawlConnector = {
  sourceKey: string;
  getDiscoveryTargets(context: CrawlContext): Promise<DiscoveryTarget[]>;
  parseDiscoverySnapshot(
    snapshot: RawSnapshot,
    context: CrawlContext,
  ): Promise<DiscoveredUrl[]>;
  parseProductCandidate?(
    snapshot: RawSnapshot,
    context: CrawlContext,
  ): Promise<ProductCandidate>;
  getDefaultPolicy(): SourceCrawlPolicy;
};
