import { performance } from "node:perf_hooks";

// A mock Supabase client that simulates network latency
class MockSupabaseClient {
  constructor() {
    this.queryCount = 0;
  }

  from(table) {
    return new MockQueryBuilder(this);
  }
}

class MockQueryBuilder {
  constructor(client) {
    this.client = client;
    this.filters = [];
    this.operation = null;
    this.payload = null;
  }

  select(columns) {
    this.operation = "select";
    return this;
  }

  insert(payload) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  limit(n) {
    return this;
  }

  async maybeSingle() {
    this.client.queryCount++;
    await new Promise((resolve) => setTimeout(resolve, 5)); // 5ms latency

    // Simulate finding the image sometimes, but mostly not
    return { data: null, error: null };
  }

  async then(resolve, reject) {
    this.client.queryCount++;
    await new Promise((res) => setTimeout(res, 5)); // 5ms latency

    if (this.operation === "select") {
      resolve({ data: [], error: null });
    } else if (this.operation === "insert") {
      resolve({ data: null, error: null });
    } else {
      resolve({ data: null, error: null });
    }
  }
}

// We need to simulate errorResponse from the original code if we want to run the exact code,
// but we can just copy the function here to benchmark it directly.

function errorResponse(status, code, message, details) {
  return new Response(JSON.stringify({ error: { code, message, details } }), { status });
}

async function ensureProductImagesOriginal(
  client,
  productId,
  imageUrls,
) {
  const primaryUrls = imageUrls.slice(0, 8).filter(Boolean);
  for (const [position, sourceUrl] of primaryUrls.entries()) {
    const { data: existingImage, error: findError } = await client
      .from("product_images")
      .select("id")
      .eq("product_id", productId)
      .eq("source_url", sourceUrl)
      .limit(1)
      .maybeSingle();

    if (findError) {
      return errorResponse(500, "db_error", "Failed to find product image", findError.message);
    }

    if (existingImage) continue;

    const { error: insertError } = await client
      .from("product_images")
      .insert({ product_id: productId, source_url: sourceUrl, position });

    if (insertError) {
      return errorResponse(500, "db_error", "Failed to create product image", insertError.message);
    }
  }

  return { imageCount: primaryUrls.length };
}

async function runBenchmark() {
  const client = new MockSupabaseClient();
  const imageUrls = [
    "http://example.com/img1.jpg",
    "http://example.com/img2.jpg",
    "http://example.com/img3.jpg",
    "http://example.com/img4.jpg",
    "http://example.com/img5.jpg",
    "http://example.com/img6.jpg",
    "http://example.com/img7.jpg",
    "http://example.com/img8.jpg",
    "http://example.com/img9.jpg", // Ignored due to slice(0, 8)
  ];

  console.log("Running baseline benchmark...");
  const start = performance.now();
  await ensureProductImagesOriginal(client, "prod-1", imageUrls);
  const end = performance.now();

  console.log(`Baseline Execution Time: ${(end - start).toFixed(2)} ms`);
  console.log(`Baseline Query Count: ${client.queryCount}`);
}

runBenchmark().catch(console.error);

async function ensureProductImagesOptimized(
  client,
  productId,
  imageUrls,
) {
  const primaryUrls = imageUrls.slice(0, 8).filter(Boolean);
  if (primaryUrls.length === 0) {
    return { imageCount: 0 };
  }

  // 1. Fetch existing images in one query
  const { data: existingImages, error: findError } = await client
    .from("product_images")
    .select("source_url")
    .eq("product_id", productId)
    .in("source_url", primaryUrls);

  if (findError) {
    return errorResponse(500, "db_error", "Failed to find product images", findError.message);
  }

  const existingUrls = new Set(existingImages?.map(img => img.source_url) || []);

  // 2. Prepare bulk insert payload
  const imagesToInsert = primaryUrls
    .map((sourceUrl, position) => ({
      product_id: productId,
      source_url: sourceUrl,
      position: position
    }))
    .filter(img => !existingUrls.has(img.source_url));

  // 3. Bulk insert if needed
  if (imagesToInsert.length > 0) {
    const { error: insertError } = await client
      .from("product_images")
      .insert(imagesToInsert);

    if (insertError) {
      return errorResponse(500, "db_error", "Failed to create product images", insertError.message);
    }
  }

  return { imageCount: primaryUrls.length };
}

async function runOptimizedBenchmark() {
  const client = new MockSupabaseClient();
  const imageUrls = [
    "http://example.com/img1.jpg",
    "http://example.com/img2.jpg",
    "http://example.com/img3.jpg",
    "http://example.com/img4.jpg",
    "http://example.com/img5.jpg",
    "http://example.com/img6.jpg",
    "http://example.com/img7.jpg",
    "http://example.com/img8.jpg",
    "http://example.com/img9.jpg", // Ignored due to slice(0, 8)
  ];

  console.log("Running optimized benchmark...");
  const start = performance.now();
  await ensureProductImagesOptimized(client, "prod-1", imageUrls);
  const end = performance.now();

  console.log(`Optimized Execution Time: ${(end - start).toFixed(2)} ms`);
  console.log(`Optimized Query Count: ${client.queryCount}`);
}

runOptimizedBenchmark().catch(console.error);
