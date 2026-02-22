import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuth, getAuthEmail } from '../../shared/auth';
import { getTheme, setTheme, type Theme } from '../../shared/theme';

export default function Settings() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    getAuthEmail().then((e) => setEmail(e || ''));
    getTheme().then(setThemeState);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await clearAuth();
    navigate('/login');
  }

  async function handleThemeToggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    await setTheme(next);
    setThemeState(next);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h2>

      {/* Appearance */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Appearance</h3>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Theme</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Currently {theme === 'dark' ? 'dark' : 'light'} mode
              </div>
            </div>
            <button
              onClick={handleThemeToggle}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                  Light Mode
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                  Dark Mode
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Account</h3>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Signed in as</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">{email || '—'}</div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors border border-red-200 dark:border-red-800"
            >
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 ml-1">
          Your data is encrypted in transit (HTTPS) and stored securely on our servers.
        </p>
      </section>

    </div>
  );
}
