import React from 'react';
import { PLATFORM_NAME } from '../lib/constants';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(message);
      if (parsed && typeof parsed.error === 'string') {
        message = parsed.error;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: Error) {
    console.error('Application boundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#1D1915]/12 rounded-xl p-8 text-center">
            <p className="text-xs tracking-[0.18em] uppercase text-[#7C5821] font-medium mb-2">
              {PLATFORM_NAME}
            </p>
            <h1 className="text-2xl font-serif font-semibold mb-3">
              Something went wrong
            </h1>
            <p className="text-sm text-[#5E554B] mb-6 leading-relaxed">
              {this.state.message}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#7C5821] text-[#FAF7F2] text-sm font-medium hover:bg-[#66471A] transition-colors cursor-pointer"
              >
                Reload page
              </button>
              <a
                href="/"
                className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg border border-[#1D1915]/15 text-sm font-medium text-[#1D1915] hover:bg-[#FAF7F2] transition-colors"
              >
                Return home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
