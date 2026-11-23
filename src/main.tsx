import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorDetail: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorDetail: '' };
  }
  static getDerivedStateFromError(error: unknown) {
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error || 'Unknown render error');
    return { hasError: true, errorDetail: detail };
  }
  componentDidCatch(error: unknown) {
    console.error('RootErrorBoundary caught:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-2">Session Reset Required</h2>
            <p className="text-xs text-slate-600 mb-2">
              Local browser state was cleared or interrupted. Reload to restore your workspace.
            </p>
            {this.state.errorDetail && (
              <pre className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 mb-4 text-left whitespace-pre-wrap break-words">
                {this.state.errorDetail}
              </pre>
            )}
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
                onClick={async () => {
                  try {
                    localStorage.removeItem('elimupulse_staff_session');
                    localStorage.removeItem('academias_secure_v1_auth');
                    localStorage.removeItem('academias_secure_v1_user');
                    if ('serviceWorker' in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      await Promise.all(regs.map((r) => r.unregister()));
                    }
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
