import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-2">Session Reset Required</h2>
            <p className="text-xs text-slate-600 mb-4">
              Local browser state was cleared or interrupted. Reload to restore your workspace.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 cursor-pointer"
              >
                Reload ElimuPulse
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('elimupulse_staff_session');
                    localStorage.removeItem('academias_secure_v1_auth');
                    localStorage.removeItem('academias_secure_v1_user');
                  } catch { /* ignore */ }
                  window.location.reload();
                }}
                className="px-3.5 py-2 bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Reset Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
