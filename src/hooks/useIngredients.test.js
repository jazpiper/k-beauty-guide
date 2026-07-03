import { renderHook, waitFor } from '@testing-library/react';
import { useIngredients } from './useIngredients';
import * as ingredientsApi from '../api/ingredientsApi';
import { fallbackIngredients } from '../data/ingredients';

jest.mock('../api/ingredientsApi');

describe('useIngredients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with fallback data and loading state', async () => {
    // We want the promise to not resolve immediately so we can check the loading state
    let resolveFetch;
    ingredientsApi.fetchIngredients.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => useIngredients());

    expect(result.current.loading).toBe(true);
    expect(result.current.ingredients).toBe(fallbackIngredients);
    expect(result.current.source).toBe('static');
    expect(result.current.error).toBe(null);

    // Now resolve the promise to clean up
    resolveFetch({ items: [], source: 'supabase', error: null });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles successful fetch', async () => {
    const mockResult = {
      items: [{ id: 1, name: 'Water' }],
      source: 'supabase',
      error: null,
    };

    ingredientsApi.fetchIngredients.mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useIngredients());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.ingredients).toEqual(mockResult.items);
    expect(result.current.source).toBe(mockResult.source);
    expect(result.current.error).toBe(null);
  });

  it('handles fetch error', async () => {
    const errorMessage = 'Network error';
    ingredientsApi.fetchIngredients.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useIngredients());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.ingredients).toBe(fallbackIngredients);
    expect(result.current.source).toBe('static');
    expect(result.current.error).toBe(errorMessage);
  });
});
