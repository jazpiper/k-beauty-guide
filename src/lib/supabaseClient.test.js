describe('isSupabaseConfigured', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.mock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => ({})),
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns true for valid configuration', () => {
    process.env.REACT_APP_SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'valid-anon-key';

    const { isSupabaseConfigured } = require('./supabaseClient');
    expect(isSupabaseConfigured).toBe(true);
  });

  it('returns false when REACT_APP_SUPABASE_URL is missing', () => {
    delete process.env.REACT_APP_SUPABASE_URL;
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'valid-anon-key';

    const { isSupabaseConfigured } = require('./supabaseClient');
    expect(isSupabaseConfigured).toBe(false);
  });

  it('returns false when REACT_APP_SUPABASE_ANON_KEY is missing', () => {
    process.env.REACT_APP_SUPABASE_URL = 'https://valid-project.supabase.co';
    delete process.env.REACT_APP_SUPABASE_ANON_KEY;

    const { isSupabaseConfigured } = require('./supabaseClient');
    expect(isSupabaseConfigured).toBe(false);
  });

  it('returns false when URL includes example.supabase.co', () => {
    process.env.REACT_APP_SUPABASE_URL = 'https://example.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'valid-anon-key';

    const { isSupabaseConfigured } = require('./supabaseClient');
    expect(isSupabaseConfigured).toBe(false);
  });

  it('returns false when key includes replace-with', () => {
    process.env.REACT_APP_SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'replace-with-your-key';

    const { isSupabaseConfigured } = require('./supabaseClient');
    expect(isSupabaseConfigured).toBe(false);
  });
});
