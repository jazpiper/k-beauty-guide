import { fetchIngredients } from "./ingredientsApi";
import { fallbackIngredients } from "../data/ingredients";
import * as supabaseClient from "../lib/supabaseClient";

jest.mock("../lib/supabaseClient", () => ({
  __esModule: true,
  isSupabaseConfigured: false,
  supabase: null,
}));

describe("ingredientsApi", () => {
  describe("fetchIngredients", () => {
    let originalIsConfigured;
    let originalSupabase;

    beforeEach(() => {
        // Save original mocked values
        originalIsConfigured = supabaseClient.isSupabaseConfigured;
        originalSupabase = supabaseClient.supabase;
    });

    afterEach(() => {
        // Restore
        Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: originalIsConfigured });
        Object.defineProperty(supabaseClient, 'supabase', { value: originalSupabase });
        jest.clearAllMocks();
    });

    test("returns static fallback ingredients when Supabase is not configured", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: false });

      const result = await fetchIngredients();

      expect(result).toEqual({
        items: fallbackIngredients,
        source: "static",
        error: null,
      });
    });

    test("returns static fallback ingredients when Supabase request fails", async () => {
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

      const result = await fetchIngredients();

      expect(mockSupabase.from).toHaveBeenCalledWith("v_public_ingredients");
      expect(mockSupabase.select).toHaveBeenCalledWith("*");
      expect(mockSupabase.order).toHaveBeenCalledWith("canonical_name", { ascending: true });

      expect(result).toEqual({
        items: fallbackIngredients,
        source: "static",
        error: "Database connection failed",
      });
    });

    test("returns mapped ingredients when Supabase request succeeds", async () => {
      Object.defineProperty(supabaseClient, 'isSupabaseConfigured', { value: true });

      const mockData = [
        {
          id: "123",
          canonical_name: "Water",
          korean_name: "정제수",
          safety_signal_count: 0,
          benefit_tags: ["hydration"],
          function_tags: ["solvent"],
          definition: "Purified water",
        },
        {
          id: "456",
          canonical_name: "Fragrance",
          korean_name: "향료",
          safety_signal_count: 1,
          benefit_tags: [],
          function_tags: ["fragrance"],
          definition: "Added scent",
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

      const result = await fetchIngredients();

      expect(result).toEqual({
        items: [
            {
                id: "123",
                name: "Water",
                korean: "정제수",
                safety: "Safe",
                benefit: "Hydration",
                desc: "Purified water",
                emoji: "🔬",
                color: "#E8F5E9",
                tags: ["Hydration", "Solvent"],
                safetySignalCount: 0,
                source: "supabase",
            },
            {
                id: "456",
                name: "Fragrance",
                korean: "향료",
                safety: "Caution",
                benefit: "Fragrance",
                desc: "Added scent",
                emoji: "🌸",
                color: "#FFF3E0",
                tags: ["Fragrance"],
                safetySignalCount: 1,
                source: "supabase",
            }
        ],
        source: "supabase",
        error: null,
      });
    });
  });
});
