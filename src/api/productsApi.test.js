import { fetchProducts, fetchProductDetail } from "./productsApi";
import { fallbackProducts } from "../data/products";
import * as supabaseClient from "../lib/supabaseClient";

jest.mock("../lib/supabaseClient", () => ({
  __esModule: true,
  isSupabaseConfigured: false,
  supabase: null,
}));

describe("productsApi", () => {
  let originalIsConfigured;
  let originalSupabase;

  beforeEach(() => {
    originalIsConfigured = supabaseClient.isSupabaseConfigured;
    originalSupabase = supabaseClient.supabase;
  });

  afterEach(() => {
    Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: originalIsConfigured });
    Object.defineProperty(supabaseClient, 'supabase', { value: originalSupabase });
    jest.clearAllMocks();
  });

  describe("fetchProducts", () => {
    test("returns static fallback products when Supabase is not configured", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: false });

      const result = await fetchProducts();

      expect(result).toEqual({
        items: fallbackProducts,
        source: "static",
        error: null,
      });
    });

    test("returns static fallback products when Supabase request fails", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: true });

      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection failed" }
        })
      };
      Object.defineProperty(supabaseClient, 'supabase', { value: mockSupabase });

      const result = await fetchProducts();

      expect(mockSupabase.from).toHaveBeenCalledWith("v_public_products");
      expect(mockSupabase.select).toHaveBeenCalledWith("*");
      expect(mockSupabase.order).toHaveBeenCalledWith("published_at", { ascending: false });

      expect(result).toEqual({
        items: fallbackProducts,
        source: "static",
        error: "Database connection failed",
      });
    });

    test("returns mapped products when Supabase request succeeds", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: true });

      const mockData = [
        {
          id: "1",
          slug: "product-1",
          name: "Test Product",
          brand_name: "Test Brand",
          flag_count: 0,
          price_krw: 15000,
          currency: "KRW",
          category: "Cleanser",
          primary_image_url: "http://example.com/img.jpg",
          highest_severity: null,
        },
        {
          id: "2",
          slug: "product-2",
          name: "Test Product 2",
          brand_name: "Test Brand 2",
          flag_count: 2,
          price_krw: 25000,
          currency: "KRW",
          category: "Toner",
          primary_image_url: "http://example.com/img2.jpg",
          highest_severity: "caution",
        }
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockData,
          error: null
        })
      };
      Object.defineProperty(supabaseClient, 'supabase', { value: mockSupabase });

      const result = await fetchProducts();

      expect(result).toEqual({
        items: [
          {
            id: "1",
            slug: "product-1",
            name: "Test Product",
            brand: "Test Brand",
            tag: "Published",
            price: "₩15,000",
            skin: "All Skin",
            category: "Cleanser",
            color: expect.any(String),
            emoji: "🧼",
            rating: null,
            reviews: 0,
            primaryImageUrl: "http://example.com/img.jpg",
            highestSeverity: null,
            safetyFlagCount: 0,
            source: "supabase",
          },
          {
            id: "2",
            slug: "product-2",
            name: "Test Product 2",
            brand: "Test Brand 2",
            tag: "2 safety notes",
            price: "₩25,000",
            skin: "All Skin",
            category: "Toner",
            color: expect.any(String),
            emoji: "🌿",
            rating: null,
            reviews: 0,
            primaryImageUrl: "http://example.com/img2.jpg",
            highestSeverity: "caution",
            safetyFlagCount: 2,
            source: "supabase",
          }
        ],
        source: "supabase",
        error: null,
      });
    });
  });

  describe("fetchProductDetail", () => {
    test("returns static fallback product details when Supabase is not configured", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: false });

      const slug = fallbackProducts[0].slug;
      const result = await fetchProductDetail(slug);

      expect(result.source).toBe("static");
      expect(result.product.slug).toBe(slug);
    });

    test("returns static fallback when product is not found in fallback data", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: false });

      const result = await fetchProductDetail("non-existent-slug");

      expect(result).toEqual({
        product: null,
        ingredients: [],
        flags: [],
        sources: [],
        images: [],
        safetyReport: { flags: [] },
        source: "static",
        error: "Product not found in fallback data.",
      });
    });

    test("returns static fallback product details when Supabase request fails", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: true });

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Failed to fetch details" }
        })
      };
      Object.defineProperty(supabaseClient, 'supabase', { value: mockSupabase });

      const slug = fallbackProducts[0].slug;
      const result = await fetchProductDetail(slug);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("get_public_product_detail", { product_slug: slug });
      expect(result.source).toBe("static");
      expect(result.product.slug).toBe(slug);
    });

    test("returns mapped product details when Supabase request succeeds", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: true });

      const mockDetail = {
        product: {
          id: "1",
          slug: "product-1",
          name: "Test Detail Product",
          brandName: "Test Brand",
          priceKrw: 20000,
          currency: "KRW",
          primaryImageUrl: "http://example.com/detail.jpg",
          category: "Essence",
          skin: "Dry",
          description: "Test description",
        },
        ingredients: [
          {
            ingredientId: "water-id",
            position: 1,
            displayName: "Water",
            inciName: "Aqua",
            koreanName: "정제수",
            reviewStatus: "matched",
          }
        ],
        safetyReport: {
          flags: [
            {
              id: "flag-1",
              ingredientId: "fragrance-id",
              ingredientName: "Fragrance",
              severity: "caution",
              title: "Fragrance note",
              whyItMatters: "Can be irritating.",
            }
          ]
        },
        sources: [],
        images: [],
        recommendedProducts: [],
      };

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          data: mockDetail,
          error: null
        })
      };
      Object.defineProperty(supabaseClient, 'supabase', { value: mockSupabase });

      const result = await fetchProductDetail("product-1");

      expect(result.source).toBe("supabase");
      expect(result.error).toBeNull();
      expect(result.product.name).toBe("Test Detail Product");
      expect(result.product.brand).toBe("Test Brand");
      expect(result.product.price).toBe("₩20,000");
      expect(result.product.category).toBe("Essence");
      expect(result.product.emoji).toBe("💧");
      expect(result.product.safetyFlagCount).toBe(1);
      expect(result.product.highestSeverity).toBe("caution");

      expect(result.ingredients[0]).toEqual({
        id: "water-id",
        ingredientId: "water-id",
        position: 1,
        name: "Water",
        canonicalName: "Water",
        inciName: "Aqua",
        korean: "정제수",
        koreanName: "정제수",
        reviewStatus: "matched",
        safety: "Info",
      });

      expect(result.flags[0]).toEqual({
        id: "flag-1",
        ingredientId: "fragrance-id",
        ingredientName: "Fragrance",
        severity: "caution",
        title: "Fragrance note",
        description: "Can be irritating.",
        whyItMatters: "Can be irritating.",
        whoShouldCare: undefined,
        recommendation: undefined,
        sourceLabel: undefined,
        sourceRegion: undefined,
        sourceUrl: undefined,
      });
    });
  });
});
