import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../shared/constants';
import { setAuth, getAuthEmail } from '../../shared/auth';

const STEPS = ['Welcome', 'Sign In', 'Done'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Auth form state
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setAuthError('Email and password required'); return; }
    setAuthError('');
    setAuthLoading(true);
    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
      } else {
        await setAuth(data.token, data.email);
        setUserEmail(data.email);
        setStep(2);
      }
    } catch {
      setAuthError('Server unavailable.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function finish() {
    await chrome.storage.local.set({ hasCompletedOnboarding: true });
    navigate('/');
  }

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      {/* Progress bar */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? 'text-blue-400' : ''}>
              {s}
            </span>
          ))}
        </div>
        <div className="h-1 bg-gray-800 rounded-full">
          <div
            className="h-1 bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="w-full max-w-lg">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center">
            <div className="text-6xl mb-6">🧠</div>
            <h1 className="text-3xl font-bold mb-3">Welcome to Session Memory</h1>
            <p className="text-gray-400 mb-8 text-lg">
              Your AI-powered productivity co-pilot. Create a free account to get started.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-10 text-sm">
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="text-2xl mb-2">📋</div>
                <div className="font-medium mb-1">Auto-tracking</div>
                <div className="text-gray-500">Every tab, note, and session saved automatically</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="text-2xl mb-2">✨</div>
                <div className="font-medium mb-1">AI Insights</div>
                <div className="text-gray-500">Summaries, next steps, and page analysis</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="text-2xl mb-2">☁️</div>
                <div className="font-medium mb-1">Your Account</div>
                <div className="text-gray-500">Data synced to your account, always available</div>
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-medium transition-colors"
            >
              Get Started →
            </button>
          </div>
        )}

        {/* Step 1: Create Account / Sign In */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Create Your Account</h2>
            <p className="text-gray-400 mb-6">
              Your data is private and encrypted. Already have an account? Switch to Sign In below.
            </p>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex gap-1 mb-5 bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setMode('register')}
                  className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Create Account
                </button>
                <button
                  onClick={() => setMode('login')}
                  className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Sign In
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Password (min. 8 characters)' : 'Password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                {authError && (
                  <p className="text-red-400 text-sm">{authError}</p>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  {authLoading ? 'Please wait…' : mode === 'register' ? 'Create Account & Continue →' : 'Sign In & Continue →'}
                </button>
              </form>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => setStep(0)}
                className="text-sm text-gray-500 hover:text-gray-300"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <div className="text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold mb-3">You're all set!</h2>
            {userEmail && (
              <p className="text-gray-400 mb-2">Signed in as <span className="text-blue-400">{userEmail}</span></p>
            )}
            <p className="text-gray-400 mb-8">
              Session Memory is running. Your browsing is now being tracked automatically.
            </p>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-8 text-left">
              <div className="text-sm font-medium text-gray-400 mb-3">Quick tips:</div>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>
                  <kbd className="bg-gray-700 text-xs px-1.5 py-0.5 rounded">Ctrl+Shift+S</kbd>
                  &nbsp; Save your current session
                </li>
                <li>
                  <kbd className="bg-gray-700 text-xs px-1.5 py-0.5 rounded">Ctrl+Shift+L</kbd>
                  &nbsp; Open the notes sidebar on any page
                </li>
                <li>
                  <kbd className="bg-gray-700 text-xs px-1.5 py-0.5 rounded">Ctrl+Shift+K</kbd>
                  &nbsp; Open the command palette
                </li>
                <li>Click the extension icon to access Focus Mode, Page Chat, and more</li>
              </ul>
            </div>

            <button
              onClick={finish}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-medium transition-colors"
            >
              Open Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
