/**
 * Enhanced Error Boundary mechanism.
 *
 * Specialized component for catching unpredictable errors in the React lifecycle:
 * - Deep diagnostic logging.
 * - Aggregation of system metrics and environment metadata.
 * - Generation of standardized reports for technical support.
 * - Visualization of call stacks and component hierarchy.
 * - Ensuring failure isolation to preserve interface integrity.
 */

import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

import { t } from '@/i18n';
import { TIME } from '../../config';
import { Icons } from './shared/Icons';

/* eslint-disable react/prop-types, react-refresh/only-export-components */

/**
 * Interface for ErrorBoundary properties.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Internal state of the error handling mechanism.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  timestamp: number | null;
}

/**
 * Structure of a formatted system error report.
 */
interface ErrorReport {
  timestamp: string;
  sessionDuration: string;
  error: string;
  stack: string;
  componentStack: string;
  userAgent: string;
  platform: string;
  screenResolution: string;
  viewport: string;
  memory: string | null;
  url: string;
}

/**
 * Extended performance object interface for access to Google Chrome metrics.
 */
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

const BYTES_IN_MB = 1048576;
const MAX_ERROR_HISTORY = 10;

/**
 * ErrorBoundary class implements the Error Boundary pattern for declarative error handling.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private readonly sessionStartTime: number;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      timestamp: null,
    };
    this.sessionStartTime = Date.now();
  }

  /**
   * Static method to update state when an exception occurs in child components.
   */
  public static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, timestamp: Date.now() };
  }

  /**
   * Error catch lifecycle for incident registration.
   */
  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorReport = this.generateErrorReport(error, errorInfo);

    // Detailed diagnostics in the developer console
    console.group(t.errors.boundaryLog);
    console.error(t.errors.errorObject, error);
    console.error(t.diagnostics.reactMetadata, errorInfo);
    console.table(errorReport);
    console.groupEnd();


    // Persistent log storage in the browser's local storage
    this.saveErrorToLocalStorage(errorReport);

    this.setState({
      error,
      errorInfo,
    });
  }

  /**
   * Formation of a comprehensive incident report.
   */
  private generateErrorReport(error: Error, errorInfo: ErrorInfo): ErrorReport {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const perf = performance as PerformanceWithMemory;
    const memory =
      perf.memory
        ? `${String(Math.round(perf.memory.usedJSHeapSize / BYTES_IN_MB))} MB / ${String(Math.round(perf.memory.jsHeapSizeLimit / BYTES_IN_MB))} MB`
        : null;

    return {
      timestamp: new Date().toISOString(),
      sessionDuration: this.formatDuration(sessionDuration),
      error: error.toString(),
      stack: error.stack ?? t.diagnostics.callStack,
      componentStack: (errorInfo.componentStack ?? '').trim(),
      userAgent: navigator.userAgent,
      platform: navigator.userAgent.toLowerCase().includes('mac') ? 'macOS' : 'Other',
      screenResolution: `${String(window.screen.width)}x${String(window.screen.height)}`,
      viewport: `${String(window.innerWidth)}x${String(window.innerHeight)}`,
      memory,
      url: window.location.href,
    };
  }

  /**
   * Transformation of a time interval into a human-readable format.
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / TIME.MS_IN_SECOND);
    const minutes = Math.floor(seconds / TIME.SECONDS_IN_MINUTE);
    const hours = Math.floor(minutes / TIME.MINUTES_IN_HOUR);

    if (hours > 0) {
      return `${String(hours)}${t.diagnostics.hours} ${String(minutes % TIME.MINUTES_IN_HOUR)}${t.diagnostics.minutes} ${String(seconds % TIME.SECONDS_IN_MINUTE)}${t.diagnostics.seconds}`;
    } else if (minutes > 0) {
      return `${String(minutes)}${t.diagnostics.minutes} ${String(seconds % TIME.SECONDS_IN_MINUTE)}${t.diagnostics.seconds}`;
    } else {
      return `${String(seconds)}${t.diagnostics.seconds}`;
    }
  }

  /**
   * Archiving an error report in localStorage with history depth limitation.
   */
  private saveErrorToLocalStorage(errorReport: ErrorReport): void {
    try {
      const stored = localStorage.getItem('entropia-errors') ?? '[]';
      const errors = JSON.parse(stored) as ErrorReport[];
      errors.push(errorReport);
      // Keep only recent incidents to prevent storage overflow
      const recentErrors = errors.slice(-MAX_ERROR_HISTORY);
      localStorage.setItem('entropia-errors', JSON.stringify(recentErrors));
    } catch (e: unknown) {
      console.warn(t.errors.localStorageError, e);
    }
  }

  /**
   * Export error report to clipboard for further submission to developers.
   */
  private readonly copyErrorReport = (): void => {
    if (!this.state.error || !this.state.errorInfo) { return; }

    const report = this.generateErrorReport(
      this.state.error,
      this.state.errorInfo
    );

    const reportText = `
${t.errors.reportTitle}
===================================

📅 ${t.errors.timestamp} ${report.timestamp}
⏱️ ${t.sidebar.sessionDuration} ${report.sessionDuration}
🌐 ${t.errors.url} ${report.url}

${t.errors.errorDetails}
--------------
${report.error}

${t.errors.stackTrace}
---------------------------
${report.stack}

${t.errors.componentStack}
--------------------------------------
${report.componentStack}

${t.errors.systemMetadata}
-----------------
${t.errors.userAgent} ${report.userAgent}
${t.diagnostics.platform} ${report.platform}
${t.errors.resolution} ${report.screenResolution}
${t.diagnostics.viewportLabel} ${report.viewport}
${report.memory ? `${t.diagnostics.memoryUsage} ${report.memory}` : ''}

${t.errors.autoGenerated}
${t.errors.sendReportTo} https://github.com/dogmator/entropia/issues
    `.trim();

    navigator.clipboard
      .writeText(reportText)
      .then(() => {
        alert(t.diagnostics.copySuccess);
      })
      .catch((err: unknown) => {
        console.error(t.diagnostics.copyError, err);
        // Fallback report text output mechanism
        prompt(t.diagnostics.copyReport, reportText);
      });
  };

  /**
   * Reset critical state and reload environment.
   */
  public handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      timestamp: null,
    });
    window.location.reload();
  };

  // eslint-disable-next-line sonarjs/function-return-type -- React required structure with conditional UI
  public override render(): ReactNode {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      const report = this.generateErrorReport(
        this.state.error,
        this.state.errorInfo
      );

      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/95 z-50 p-4">
          <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <ErrorHeader timestamp={report.timestamp} />
            <ErrorTelemetry report={report} />
            <ErrorDetails error={this.state.error.toString()} />
            <ErrorStacks report={report} />
            <ErrorActions
              onReset={this.handleReset}
              onCopy={this.copyErrorReport}
            />
          </div>
        </div>
      );
    }

    return this.props.children ?? null;
  }
}

/**
 * Critical alert header section
 */
const ErrorHeader: React.FC<{ timestamp: string }> = ({ timestamp }) => (
  <div className="flex items-center gap-4 mb-6">
    <div className="p-3 rounded-xl bg-red-500/20">
      <Icons.Alert />
    </div>
    <div className="flex-1">
      <h1 className="text-2xl font-black text-red-400 tracking-wide">{t.errors.criticalFailure}</h1>
      <p className="text-sm text-gray-400 mt-1">{t.errors.simulationPaused}</p>
    </div>
    <div className="text-xs text-gray-600">
      {timestamp.split('T')[1]?.split('.')[0] ?? 'N/A'}
    </div>
  </div>
);

/**
 * System telemetry block
 */
const ErrorTelemetry: React.FC<{ report: ErrorReport }> = ({ report }) => (
  <div className="bg-black/30 rounded-xl p-4 mb-4 text-xs space-y-2">
    <TelemetryRow label={t.sidebar.sessionDuration} value={report.sessionDuration} />
    <TelemetryRow label={t.diagnostics.viewportLabel} value={report.viewport} />
    {report.memory && <TelemetryRow label={t.diagnostics.memoryUsage} value={report.memory} />}
  </div>
);

const TelemetryRow: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-gray-500">
    <span>{label}</span>
    <span className="text-gray-400 font-mono">{value}</span>
  </div>
);

/**
 * Details of identified error
 */
const ErrorDetails: React.FC<{ error: string }> = ({ error }) => (
  <div className="bg-black/50 rounded-xl p-4 mb-4 font-mono text-sm text-red-300 max-h-48 overflow-y-auto custom-scrollbar">
    <div className="mb-2 text-xs text-gray-500 uppercase tracking-widest">{t.diagnostics.exceptionDesc}</div>
    <div className="whitespace-pre-wrap break-all">{error}</div>
  </div>
);

/**
 * Technical reports (Stacks)
 */
const ErrorStacks: React.FC<{ report: ErrorReport }> = ({ report }) => (
  <div className="space-y-3 mb-6">
    <StackDetails title={t.errors.jsStack} content={report.stack} />
    <StackDetails title={t.errors.reactStack} content={report.componentStack} />
    <StackDetails title={t.diagnostics.systemEnvironment}>
      <div className="space-y-1">
        <div><span className="text-gray-600">{t.diagnostics.platform}</span> {report.platform}</div>
        <div className="break-all"><span className="text-gray-600">{t.errors.userAgent}</span> {report.userAgent}</div>
      </div>
    </StackDetails>
  </div>
);

const StackDetails: React.FC<{ title: string, content?: string, children?: React.ReactNode }> = ({ title, content, children }) => (
  <details className="bg-black/30 rounded-xl overflow-hidden">
    <summary className="cursor-pointer p-4 hover:bg-black/50 transition-colors text-sm text-gray-400 font-semibold">
      {title}
    </summary>
    <div className="p-4 text-xs text-gray-500 font-mono overflow-x-auto whitespace-pre-wrap break-all">
      {content ?? children}
    </div>
  </details>
);

/**
 * Recovery control elements
 */
const ErrorActions: React.FC<{ onReset: () => void, onCopy: () => void }> = ({ onReset, onCopy }) => (
  <div className="flex gap-3 flex-wrap">
    <ActionButton onClick={onReset} variant="emerald" label={t.controls.reset}>
      <Icons.Reset className="w-5 h-5" />
    </ActionButton>
    <ActionButton onClick={onCopy} variant="blue" label={t.diagnostics.exportReport}>
      <Icons.Copy />
    </ActionButton>
    <button
      onClick={() => window.open('https://github.com/dogmator/entropia/issues', '_blank', 'noopener,noreferrer')}
      className="flex-1 h-12 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 min-w-[200px]"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
      {t.errors.reportIncident}
    </button>
  </div>
);

const ActionButton: React.FC<{ onClick: () => void, variant: 'emerald' | 'blue', label: string, children: React.ReactNode }> = ({ onClick, variant, label, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 h-12 rounded-lg ${variant === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'} transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 min-w-[200px]`}
  >
    {children}
    {label}
  </button>
);
