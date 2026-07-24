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
