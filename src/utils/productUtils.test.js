import { normalizeSourceLink } from './productUtils';

describe('normalizeSourceLink', () => {
  it('returns null for falsy inputs', () => {
    expect(normalizeSourceLink(null)).toBeNull();
    expect(normalizeSourceLink(undefined)).toBeNull();
    expect(normalizeSourceLink('')).toBeNull();
  });

  describe('string inputs', () => {
    it('handles valid HTTP/HTTPS URLs', () => {
      expect(normalizeSourceLink('https://example.com/page')).toEqual({
        url: 'https://example.com/page',
        label: 'example.com',
        evidence: '',
        publishedAt: ''
      });
      expect(normalizeSourceLink('http://www.test.org')).toEqual({
        url: 'http://www.test.org',
        label: 'test.org',
        evidence: '',
        publishedAt: ''
      });
    });

    it('sanitizes invalid/unsafe URLs', () => {
      expect(normalizeSourceLink('Source')).toEqual({
        url: '',
        label: 'Source',
        evidence: '',
        publishedAt: ''
      });
      expect(normalizeSourceLink('Source')).toEqual({
        url: '',
        label: 'Source',
        evidence: '',
        publishedAt: ''
      });
    });
  });

  describe('object inputs', () => {
    it('extracts URL from url, href, or sourceUrl', () => {
      expect(normalizeSourceLink({ url: 'https://a.com' }).url).toBe('https://a.com');
      expect(normalizeSourceLink({ href: 'https://b.com' }).url).toBe('https://b.com');
      expect(normalizeSourceLink({ sourceUrl: 'https://c.com' }).url).toBe('https://c.com');
      // Priority test
      expect(normalizeSourceLink({ url: 'https://a.com', href: 'https://b.com' }).url).toBe('https://a.com');
    });

    it('extracts label from label, title, or name', () => {
      // If URL is missing, it should just use the label directly
      expect(normalizeSourceLink({ label: 'My Label' }).label).toBe('My Label');
      expect(normalizeSourceLink({ title: 'My Title' }).label).toBe('My Title');
      expect(normalizeSourceLink({ name: 'My Name' }).label).toBe('My Name');
      // Priority test
      expect(normalizeSourceLink({ label: 'Label 1', title: 'Title 1' }).label).toBe('Label 1');
    });

    it('falls back to hostname for label if URL is present but label is not', () => {
      expect(normalizeSourceLink({ url: 'https://www.demo.com' }).label).toBe('demo.com');
    });

    it('prefers provided label over hostname if URL is present', () => {
      expect(normalizeSourceLink({ url: 'https://www.demo.com', label: 'Custom Label' }).label).toBe('Custom Label');
    });

    it('extracts evidence from evidence or description', () => {
      expect(normalizeSourceLink({ evidence: 'Some proof' }).evidence).toBe('Some proof');
      expect(normalizeSourceLink({ description: 'Some desc' }).evidence).toBe('Some desc');
      // Priority test
      expect(normalizeSourceLink({ evidence: 'Proof 1', description: 'Desc 1' }).evidence).toBe('Proof 1');
    });

    it('extracts publishedAt from publishedAt or date', () => {
      expect(normalizeSourceLink({ publishedAt: '2023-01-01' }).publishedAt).toBe('2023-01-01');
      expect(normalizeSourceLink({ date: '2023-02-02' }).publishedAt).toBe('2023-02-02');
      // Priority test
      expect(normalizeSourceLink({ publishedAt: '2023-01-01', date: '2023-02-02' }).publishedAt).toBe('2023-01-01');
    });

    it('handles comprehensive object inputs correctly', () => {
      expect(normalizeSourceLink({
        url: 'https://www.full.com/article',
        label: 'Full Article',
        evidence: 'This is the evidence.',
        publishedAt: '2024-05-10'
      })).toEqual({
        url: 'https://www.full.com/article',
        label: 'Full Article',
        evidence: 'This is the evidence.',
        publishedAt: '2024-05-10'
      });
    });
  });
});
