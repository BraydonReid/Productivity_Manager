import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuth, getAuthEmail } from '../../shared/auth';

export default function Settings() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    getAuthEmail().then((e) => setEmail(e || ''));
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await clearAuth();
    navigate('/login');
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      {/* Account */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-3">Account</h3>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 mb-1">Signed in as</div>
              <div className="text-white font-medium">{email || '—'}</div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
            >
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Your data is encrypted in transit (HTTPS) and stored securely on our servers.
        </p>
      </section>
    </div>
  );
}
