import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient';

export function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    const finishAuth = async () => {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
        } else {
          setSession(data.session);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        const { data } = await client.auth.getSession();
        setSession(data.session);
      }
      setLoading(false);
    };

    finishAuth();

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setMessage('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }
  };

  const submitEmailPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setMessage('');
    setLoading(true);
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === 'sign-up' && !result.data.session) {
      setMessage('Check your email to confirm your account, then sign in.');
    }
  };

  if (!hasSupabaseConfig) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Supabase setup required</h1>
          <p>Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`, then restart the dev server.</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main className="auth-shell"><section className="auth-card"><p>Loading...</p></section></main>;
  }

  if (session?.user) return <>{children(session.user)}</>;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Excerpt Tracker</p>
        <h1>Sign in</h1>
        <p>Your excerpts sync securely to your account.</p>
        <button className="google-button" type="button" onClick={signInWithGoogle}>
          <span>G</span>
          Continue with Google
        </button>
        <div className="auth-divider"><span>or</span></div>
        <form className="email-auth-form" onSubmit={submitEmailPassword}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          </label>
          <button className="primary-button" type="submit">
            {mode === 'sign-in' ? 'Sign in with email' : 'Create email account'}
          </button>
          <button className="text-button" type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
            {mode === 'sign-in' ? 'Create an email account' : 'I already have an email account'}
          </button>
        </form>
        {message && <p className="error-text">{message}</p>}
      </section>
    </main>
  );
}
