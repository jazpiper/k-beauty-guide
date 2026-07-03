import { renderHook, waitFor } from '@testing-library/react';
import { useProducts } from './useProducts';
import * as productsApi from '../api/productsApi';
import { fallbackProducts } from '../data/products';

jest.mock('../api/productsApi');

describe('useProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles successful fetch', async () => {
    const mockData = {
      items: [{ id: 'test-product', name: 'Test Product' }],
      source: 'supabase',
      error: null
    };

    productsApi.fetchProducts.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useProducts());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual(mockData.items);
    expect(result.current.source).toBe('supabase');
    expect(result.current.error).toBe(null);
  });

  it('handles fetch error', async () => {
    const errorMessage = 'Network error';
    productsApi.fetchProducts.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useProducts());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual(fallbackProducts);
    expect(result.current.source).toBe('static');
    expect(result.current.error).toBe(errorMessage);
  });
});
