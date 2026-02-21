import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../shared/constants';
import { setAuth } from '../../shared/auth';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        // Check onboarding status
        const onboarded = await chrome.storage.local.get('hasCompletedOnboarding');
        if (!onboarded.hasCompletedOnboarding) {
          navigate('/onboarding');
        } else {
          navigate('/');
        }
      }
    } catch {
      setError('Server unavailable. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-white mb-2">Session Memory</div>
          <div className="text-gray-400 text-sm">Your AI-powered productivity companion</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e as any)}
              />
            </div>
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-400 text-xs">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Your data is private and stored securely.
        </p>
      </div>
    </div>
  );
}
