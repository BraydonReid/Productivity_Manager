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
    if (!email || !password) { setError('Email and password required'); return; }
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
      setError('Server unavailable. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  if (authenticated === null) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>;
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="p-4">
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-white mb-1">Session Memory</div>
        <div className="text-xs text-gray-400">{mode === 'login' ? 'Sign in to your account' : 'Create an account'}</div>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-800 rounded p-1">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 text-xs py-1 rounded ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
        >
          Sign In
        </button>
        <button
          onClick={() => setMode('register')}
          className={`flex-1 text-xs py-1 rounded ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm font-medium"
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
