import { renderHook, waitFor } from "@testing-library/react";
import { useDataFetch } from "./useDataFetch";

describe("useDataFetch", () => {
  const fallbackData = [{ id: 1, name: "Fallback Item" }];

  it("initializes with fallback data and loading state", async () => {
    let resolveFetch;
    const fetchFn = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => useDataFetch(fetchFn, fallbackData));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(fallbackData);
    expect(result.current.source).toBe("static");
    expect(result.current.error).toBe(null);

    resolveFetch({ items: [{ id: 2, name: "Fetched Item" }], source: "supabase", error: null });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("handles successful fetch response", async () => {
    const mockResult = {
      items: [{ id: 10, name: "Product A" }],
      source: "supabase",
      error: null,
    };
    const fetchFn = jest.fn().mockResolvedValue(mockResult);

    const { result } = renderHook(() => useDataFetch(fetchFn, fallbackData));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockResult.items);
    expect(result.current.source).toBe("supabase");
    expect(result.current.error).toBe(null);
  });

  it("handles fetch rejection / network error", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("Network Error"));

    const { result } = renderHook(() => useDataFetch(fetchFn, fallbackData));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(fallbackData);
    expect(result.current.source).toBe("static");
    expect(result.current.error).toBe("Network Error");
  });

  it("does not update state if unmounted before fetch resolves", async () => {
    let resolveFetch;
    const fetchFn = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result, unmount } = renderHook(() => useDataFetch(fetchFn, fallbackData));

    unmount();

    resolveFetch({ items: [{ id: 99 }], source: "supabase", error: null });
    await Promise.resolve();

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(fallbackData);
  });

  it("does not update state if unmounted before fetch rejects", async () => {
    let rejectFetch;
    const fetchFn = jest.fn().mockReturnValue(
      new Promise((_, reject) => {
        rejectFetch = reject;
      })
    );

    const { result, unmount } = renderHook(() => useDataFetch(fetchFn, fallbackData));

    unmount();

    rejectFetch(new Error("Failed request"));
    await Promise.resolve().catch(() => {});

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(fallbackData);
  });

  it("refetches when fetchFn or fallbackData dependency changes", async () => {
    const fetchFn1 = jest.fn().mockResolvedValue({ items: ["A"], source: "remote", error: null });
    const fetchFn2 = jest.fn().mockResolvedValue({ items: ["B"], source: "remote", error: null });

    const { result, rerender } = renderHook(
      ({ fn, fallback }) => useDataFetch(fn, fallback),
      { initialProps: { fn: fetchFn1, fallback: fallbackData } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual(["A"]);

    rerender({ fn: fetchFn2, fallback: fallbackData });

    await waitFor(() => {
      expect(result.current.data).toEqual(["B"]);
    });

    expect(fetchFn1).toHaveBeenCalledTimes(1);
    expect(fetchFn2).toHaveBeenCalledTimes(1);
  });
});
