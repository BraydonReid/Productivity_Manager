import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../shared/constants';
import { setAuth, getToken } from '../../shared/auth';

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getToken().then((token) => setAuthenticated(Boolean(token)));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
      } else {
        await setAuth(data.token, data.email);
        setAuthenticated(true);
      }
    } catch {
      setError('Could not reach the server. Try again shortly.');
    } finally {
      setLoading(false);
    }
  }

  if (authenticated === null) {
    return (
      <div className="w-80 h-48 flex items-center justify-center bg-gray-900">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authenticated) return <>{children}</>;

  return (
    <div className="w-80 bg-gray-900 text-white p-5">
      <div className="text-center mb-5">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </div>
        <div className="text-base font-semibold">Session Memory</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => { setMode('login'); setError(''); }}
          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
            mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => { setMode('register'); setError(''); }}
          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
            mode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Please wait…
            </span>
          ) : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
