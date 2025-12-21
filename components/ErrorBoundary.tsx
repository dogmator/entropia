
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary компонент для перехоплення помилок React
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary перехопив помилку:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/95 z-50 p-4">
          <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-8 max-w-2xl w-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-red-500/20">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-black text-red-400 tracking-wide">Виникла помилка</h1>
                <p className="text-sm text-gray-400 mt-1">Симуляція зупинена через несподівану помилку</p>
              </div>
            </div>

            <div className="bg-black/50 rounded-xl p-4 mb-6 font-mono text-sm text-red-300 max-h-64 overflow-y-auto custom-scrollbar">
              <div className="mb-2 text-xs text-gray-500 uppercase tracking-widest">Деталі помилки:</div>
              <div>{this.state.error?.toString()}</div>
              {this.state.errorInfo && (
                <details className="mt-4 text-xs text-gray-400">
                  <summary className="cursor-pointer hover:text-white">Стек викликів</summary>
                  <pre className="mt-2 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                </details>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 h-12 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Перезавантажити додаток
              </button>
              <button
                onClick={() => window.location.href = 'https://github.com/dogmator/entropia/issues'}
                className="h-12 px-6 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all font-bold text-sm uppercase tracking-widest"
              >
                Повідомити про помилку
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
