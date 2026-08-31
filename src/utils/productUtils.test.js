import { asArray } from './productUtils';
import { isSafeHttpUrl } from './productUtils';
import { getHighestSeverity, normalizeSeverity, getSeverityLabel } from './productUtils';
import { SEVERITY_RANK } from '../constants/severity';

describe('productUtils', () => {
  describe('normalizeSeverity', () => {
    it('returns "none" for null or undefined', () => {
      expect(normalizeSeverity(null)).toBe('none');
      expect(normalizeSeverity(undefined)).toBe('none');
      expect(normalizeSeverity('')).toBe('none');
    });

    it('lowercases severity strings', () => {
      expect(normalizeSeverity('HIGH')).toBe('high');
      expect(normalizeSeverity('Medium')).toBe('medium');
      expect(normalizeSeverity('SAFE')).toBe('safe');
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
      // 'low' has rank 1, 'unknown_weird_flag' has rank undefined (treated as 0)
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
});

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
