import { renderHook, waitFor } from '@testing-library/react';
import { useProductDetail } from './useProductDetail';
import * as productsApi from '../api/productsApi';

jest.mock('../api/productsApi');

const emptyDetail = {
  product: null,
  ingredients: [],
  flags: [],
  sources: [],
  images: [],
  safetyReport: { flags: [] },
  source: 'static',
  error: null,
};

describe('useProductDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles missing slug', async () => {
    const { result } = renderHook(() => useProductDetail(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Missing product slug.');
    expect(result.current.product).toBe(null);
  });

  it('handles successful fetch', async () => {
    const mockProductData = {
      product: { name: 'Test Product' },
      ingredients: [{ name: 'Water' }]
    };

    productsApi.fetchProductDetail.mockResolvedValueOnce(mockProductData);

    const { result } = renderHook(() => useProductDetail('test-slug'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.product).toEqual({ name: 'Test Product' });
    expect(result.current.ingredients).toEqual([{ name: 'Water' }]);
    expect(result.current.error).toBe(null);
  });

  it('handles fetch error', async () => {
    const errorMessage = 'Network error';
    productsApi.fetchProductDetail.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useProductDetail('error-slug'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.product).toBe(null);
  });
});
