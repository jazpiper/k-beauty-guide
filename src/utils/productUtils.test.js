import { asArray } from './productUtils';

describe('productUtils', () => {
  describe('asArray', () => {
    it('should return an empty array for null or undefined', () => {
      expect(asArray(null)).toEqual([]);
      expect(asArray(undefined)).toEqual([]);
    });

    it('should return an empty array for falsy values', () => {
      expect(asArray(false)).toEqual([]);
      expect(asArray('')).toEqual([]);
      expect(asArray(0)).toEqual([]);
    });

    it('should filter out falsy values from an array', () => {
      expect(asArray([null, undefined, 1, 'test', false, 0, ''])).toEqual([1, 'test']);
    });

    it('should return the same array if no falsy values exist', () => {
      expect(asArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(asArray(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('should wrap a single truthy object in an array', () => {
      const obj = { a: 1 };
      expect(asArray(obj)).toEqual([obj]);
    });

    it('should wrap a single truthy primitive in an array', () => {
      expect(asArray('test')).toEqual(['test']);
      expect(asArray(1)).toEqual([1]);
      expect(asArray(true)).toEqual([true]);
    });

    it('should return an empty array if passed an empty array', () => {
      expect(asArray([])).toEqual([]);
    });
  });
});
