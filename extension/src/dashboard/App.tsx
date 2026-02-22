import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { getTheme, applyTheme } from '../shared/theme';
import SessionList from './pages/SessionList';
import SessionDetail from './pages/SessionDetail';
import SearchResults from './pages/SearchResults';
import Journal from './pages/Journal';
import FocusHistory from './pages/FocusHistory';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Apply saved theme immediately to avoid flash
    getTheme().then(applyTheme);

    async function checkAuth() {
      const { authToken, hasCompletedOnboarding } = await chrome.storage.local.get([
        'authToken',
        'hasCompletedOnboarding',
      ]);

      const isLoginPage = location.pathname === '/login';
      const isOnboardingPage = location.pathname === '/onboarding';

      if (!authToken) {
        if (!isLoginPage) navigate('/login', { replace: true });
        setReady(true);
        return;
      }

      if (!hasCompletedOnboarding && !isOnboardingPage) {
        navigate('/onboarding', { replace: true });
        setReady(true);
        return;
      }

      setReady(true);
    }

    checkAuth();
  }, []);

  if (!ready) return null;

  const isFullPage = location.pathname === '/onboarding' || location.pathname === '/login';

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors">
      {!isFullPage && <Sidebar />}
      <main className={`flex-1 overflow-y-auto${isFullPage ? '' : ' p-6'}`}>
        <Routes>
          <Route path="/" element={<SessionList />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/focus" element={<FocusHistory />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
