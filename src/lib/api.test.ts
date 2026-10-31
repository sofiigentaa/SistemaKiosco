import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAccount, requestPasswordReset, resetPassword, signIn } from './api';

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('./supabaseAuth', () => ({ supabaseAuth: { auth } }));

describe('Supabase authentication adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: 'user-1', email: 'person@example.com' } }), { status: 200 })));
    auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'access-token' } }, error: null });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('authenticates with Supabase then exchanges its access token with the kiosk API', async () => {
    expect(await signIn('person@example.com', 'password')).toBeNull();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'person@example.com', password: 'password' });
    expect(fetch).toHaveBeenCalledWith('/api/auth/exchange', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ accessToken: 'access-token' }),
    }));
  });

  it('registers through Supabase and waits for email confirmation when no session is returned', async () => {
    await expect(registerAccount('new@example.com', 'a-long-password')).resolves.toEqual({
      message: 'Te enviamos un email para confirmar la cuenta. Revisá tu bandeja de entrada.',
    });
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.com',
      options: { emailRedirectTo: window.location.origin },
    }));
  });

  it('requests recovery and updates the password through Supabase Auth', async () => {
    await expect(requestPasswordReset('person@example.com')).resolves.toMatchObject({ message: expect.any(String) });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.com', {
      redirectTo: `${window.location.origin}/?reset=1`,
    });

    await expect(resetPassword('new-long-password')).resolves.toBeNull();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-long-password' });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});
