import {
  isSafeHttpUrl,
  asArray,
  normalizeImage,
  normalizeSourceLink,
  normalizePurchaseLink,
  normalizeRecommendedProduct,
  mergeUniqueLinks,
  getSearchUrl,
  normalizeSeverity,
  getSeverityLabel,
  getHighestSeverity,
  formatPrice,
  formatDate,
} from './productUtils';

describe('productUtils', () => {
  describe('isSafeHttpUrl', () => {
    it('returns true for valid HTTP and HTTPS URLs', () => {
      expect(isSafeHttpUrl('http://example.com')).toBe(true);
      expect(isSafeHttpUrl('https://example.com')).toBe(true);
      expect(isSafeHttpUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('returns false for invalid protocols', () => {
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,<h1>Hello</h1>')).toBe(false);
      expect(isSafeHttpUrl('ftp://example.com')).toBe(false);
      expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
    });

    it('returns false for invalid types and values', () => {
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl(undefined)).toBe(false);
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl(123)).toBe(false);
      expect(isSafeHttpUrl([])).toBe(false);
      expect(isSafeHttpUrl({})).toBe(false);
    });

    it('returns false for malformed URLs', () => {
      expect(isSafeHttpUrl('not a url')).toBe(false);
      expect(isSafeHttpUrl('://missing-protocol')).toBe(false);
      expect(isSafeHttpUrl('http://[::1')).toBe(false);
    });
  });

  describe('asArray', () => {
    it('returns empty array for falsy values', () => {
      expect(asArray(null)).toEqual([]);
      expect(asArray(undefined)).toEqual([]);
      expect(asArray('')).toEqual([]);
    });

    it('filters falsy items from array', () => {
      expect(asArray(['a', null, 'b', undefined, ''])).toEqual(['a', 'b']);
    });

    it('wraps non-array value in array', () => {
      expect(asArray('item')).toEqual(['item']);
    });
  });

  describe('normalizeImage', () => {
    it('returns null for falsy input', () => {
      expect(normalizeImage(null)).toBeNull();
      expect(normalizeImage('')).toBeNull();
    });

    it('returns string image url directly', () => {
      expect(normalizeImage('https://img.com/a.jpg')).toBe('https://img.com/a.jpg');
    });

    it('extracts url from image object properties', () => {
      expect(normalizeImage({ url: 'https://img.com/url.jpg' })).toBe('https://img.com/url.jpg');
      expect(normalizeImage({ src: 'https://img.com/src.jpg' })).toBe('https://img.com/src.jpg');
      expect(normalizeImage({ imageUrl: 'https://img.com/imageUrl.jpg' })).toBe('https://img.com/imageUrl.jpg');
      expect(normalizeImage({ publicUrl: 'https://img.com/publicUrl.jpg' })).toBe('https://img.com/publicUrl.jpg');
    });
  });

  describe('normalizeSourceLink', () => {
    it('returns null for falsy input', () => {
      expect(normalizeSourceLink(null)).toBeNull();
      expect(normalizeSourceLink('')).toBeNull();
    });

    it('normalizes string url input and parses hostname label', () => {
      const result = normalizeSourceLink('https://www.example.com/item');
      expect(result.url).toBe('https://www.example.com/item');
      expect(result.label).toBe('example.com');
    });

    it('normalizes object source input with custom properties and fallbacks', () => {
      const result = normalizeSourceLink({
        url: 'https://example.com/source',
        label: 'Custom Label',
        evidence: 'Clinical study evidence',
        publishedAt: '2026-01-01',
      });
      expect(result).toEqual({
        url: 'https://example.com/source',
        label: 'Custom Label',
        evidence: 'Clinical study evidence',
        publishedAt: '2026-01-01',
      });
    });

    it('falls back to property aliases when normalizing object source', () => {
      expect(
        normalizeSourceLink({
          href: 'https://test.com/paper',
          title: 'Study Title',
          description: 'Description text',
          date: '2022-05-10',
        })
      ).toEqual({
        url: 'https://test.com/paper',
        label: 'Study Title',
        evidence: 'Description text',
        publishedAt: '2022-05-10',
      });
    });
  });

  describe('normalizePurchaseLink', () => {
    it('returns null for falsy or invalid input', () => {
      expect(normalizePurchaseLink(null)).toBeNull();
      expect(normalizePurchaseLink('invalid-url')).toBeNull();
    });

    it('normalizes valid string URL', () => {
      expect(normalizePurchaseLink('https://store.com/buy')).toEqual({
        label: 'Buy now',
        url: 'https://store.com/buy',
      });
    });

    it('normalizes object input with custom label or fallbacks', () => {
      expect(normalizePurchaseLink({ url: 'https://store.com/item', label: 'Shop Here' })).toEqual({
        label: 'Shop Here',
        url: 'https://store.com/item',
      });
      expect(normalizePurchaseLink({ href: 'https://store.com/item2', name: 'Official Store' })).toEqual({
        label: 'Official Store',
        url: 'https://store.com/item2',
      });
    });
  });

  describe('normalizeRecommendedProduct', () => {
    it('returns null for falsy input', () => {
      expect(normalizeRecommendedProduct(null)).toBeNull();
      expect(normalizeRecommendedProduct(undefined)).toBeNull();
    });

    it('normalizes item object with fallbacks', () => {
      expect(
        normalizeRecommendedProduct({
          id: 'prod-1',
          slug: 'prod-1-slug',
          name: 'Moisturizer',
          brandName: 'Brand X',
          category: 'Cream',
          skin: 'Dry',
          highestSeverity: 'CAUTION',
        })
      ).toEqual({
        id: 'prod-1',
        slug: 'prod-1-slug',
        name: 'Moisturizer',
        brand: 'Brand X',
        category: 'Cream',
        skin: 'Dry',
        highestSeverity: 'caution',
      });
    });
  });

  describe('mergeUniqueLinks', () => {
    it('deduplicates links based on url or lowercase label', () => {
      const links = [
        { url: 'https://example.com/1', label: 'Link 1' },
        { url: 'https://example.com/1', label: 'Duplicate URL Link' },
        { url: '', label: 'Same Label' },
        { url: '', label: 'SAME LABEL' },
        { url: 'https://example.com/2', label: 'Unique Link' },
      ];

      expect(mergeUniqueLinks(links)).toEqual([
        { url: 'https://example.com/1', label: 'Link 1' },
        { url: '', label: 'Same Label' },
        { url: 'https://example.com/2', label: 'Unique Link' },
      ]);
    });
  });

  describe('getSearchUrl', () => {
    it('returns empty string if product has no name and brand', () => {
      expect(getSearchUrl(null)).toBe('');
      expect(getSearchUrl({})).toBe('');
    });

    it('generates google search url for product', () => {
      expect(getSearchUrl({ brand: 'Cosrx', name: 'Snail Mucin' })).toContain('https://www.google.com/search?q=Cosrx%20Snail%20Mucin');
    });
  });

  describe('normalizeSeverity', () => {
    it('returns "none" for null or undefined', () => {
      expect(normalizeSeverity(null)).toBe('none');
      expect(normalizeSeverity(undefined)).toBe('none');
      expect(normalizeSeverity('')).toBe('none');
    });

    it('lowercases severity strings', () => {
      expect(normalizeSeverity('HIGH')).toBe('high');
      expect(normalizeSeverity('Medium')).toBe('medium');
      expect(normalizeSeverity('Avoid_If_Sensitive')).toBe('avoid_if_sensitive');
    });
  });

  describe('getSeverityLabel', () => {
    it('formats severity strings into human-readable labels', () => {
      expect(getSeverityLabel(null)).toBe('No flags');
      expect(getSeverityLabel('none')).toBe('No flags');
      expect(getSeverityLabel('avoid_if_sensitive')).toBe('Avoid if sensitive');
      expect(getSeverityLabel('restricted')).toBe('Restricted');
      expect(getSeverityLabel('high_risk')).toBe('High Risk');
    });
  });

  describe('getHighestSeverity', () => {
    it('returns "none" when all inputs are empty or null', () => {
      expect(getHighestSeverity(null, null, null)).toBe('none');
      expect(getHighestSeverity({}, [], [])).toBe('none');
    });

    it('returns normalized product.highestSeverity if it exists', () => {
      expect(getHighestSeverity({ highestSeverity: 'HIGH' }, [{ severity: 'restricted' }], [])).toBe('high');
    });

    it('computes highest severity from flags', () => {
      const flags = [{ severity: 'low' }, { severity: 'high' }, { severity: 'medium' }];
      expect(getHighestSeverity({}, flags, [])).toBe('high');
    });

    it('computes highest severity from ingredients using highestSeverity', () => {
      const ingredients = [{ highestSeverity: 'caution' }, { highestSeverity: 'restricted' }];
      expect(getHighestSeverity({}, [], ingredients)).toBe('restricted');
    });

    it('computes highest severity from ingredients using safety if highestSeverity is missing', () => {
      const ingredients = [{ safety: 'low' }, { safety: 'avoid_if_sensitive' }];
      expect(getHighestSeverity({}, [], ingredients)).toBe('avoid_if_sensitive');
    });

    it('computes absolute highest across both flags and ingredients', () => {
      const flags = [{ severity: 'medium' }];
      const ingredients = [{ highestSeverity: 'high' }, { safety: 'low' }];
      expect(getHighestSeverity({}, flags, ingredients)).toBe('high');
    });

    it('handles unknown severities gracefully (treated as rank 0 / none)', () => {
      const flags = [{ severity: 'unknown_weird_flag' }, { severity: 'low' }];
      expect(getHighestSeverity({}, flags, [])).toBe('low');
    });

    it('returns "none" if all provided severities are unknown', () => {
      const flags = [{ severity: 'unknown1' }];
      const ingredients = [{ safety: 'unknown2' }];
      expect(getHighestSeverity({}, flags, ingredients)).toBe('none');
    });

    it('ignores null or undefined flags and ingredients', () => {
      const flags = [null, { severity: 'medium' }, undefined];
      const ingredients = [undefined, null, { highestSeverity: 'low' }];
      expect(getHighestSeverity({}, flags, ingredients)).toBe('medium');
    });
  });

  describe('formatPrice', () => {
    it('returns empty string for falsy input', () => {
      expect(formatPrice(null)).toBe('');
      expect(formatPrice(undefined)).toBe('');
    });

    it('returns string price directly if product.price is a string', () => {
      expect(formatPrice({ price: '$25.00' })).toBe('$25.00');
    });

    it('formats priceKrw with KRW locale currency symbol when numeric or numeric string', () => {
      expect(formatPrice({ priceKrw: 15000 })).toBe('₩15,000');
      expect(formatPrice({ priceKrw: '20,000 KRW' })).toBe('₩20,000');
    });

    it('formats numeric price and currency using Intl.NumberFormat', () => {
      expect(formatPrice({ price: 19.99, currency: 'USD' })).toBe('$19.99');
    });

    it('returns string price directly if product.price is string, even with currency', () => {
      expect(formatPrice({ price: '19.99', currency: 'USD' })).toBe('19.99');
    });

    it('returns price string representation if only numeric price exists', () => {
      expect(formatPrice({ price: 30 })).toBe('30');
    });
  });

  describe('formatDate', () => {
    it('returns empty string for falsy or invalid dates', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate('invalid-date')).toBe('');
    });

    it('formats valid dates into short month, numeric day, and numeric year format', () => {
      const formatted = formatDate('2023-11-15T00:00:00Z');
      expect(formatted).toMatch(/Nov 15, 2023/);
    });
  });
});
