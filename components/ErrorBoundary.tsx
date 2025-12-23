/**
 * Розширений механізм обробки винятків (Enhanced Error Boundary).
 *
 * Спеціалізований компонент для перехоплення непередбачуваних помилок у життєвому циклі React:
 * - Глибоке діагностичне логування.
 * - Агрегація системних метрик та метаданих середовища.
 * - Генерація стандартизованих звітів для технічної підтримки.
 * - Візуалізація стеку викликів та ієрархії компонентів.
 * - Забезпечення ізоляції збоїв для збереження цілісності інтерфейсу.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Програмний інтерфейс для властивостей ErrorBoundary.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Внутрішній стан механізму обробки винятків.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  timestamp: number | null;
}

/**
 * Структура форматованого звіту про системну помилку.
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
 * Клас ErrorBoundary реалізує патерн Error Boundary для декларативної обробки помилок.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private sessionStartTime: number;

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
   * Статичний метод для оновлення стану при виникненні винятку у дочірніх компонентах.
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, timestamp: Date.now() };
  }

  /**
   * Життєвий цикл перехоплення помилки для реєстрації інциденту.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorReport = this.generateErrorReport(error, errorInfo);

    // Розгорнута діагностика в консолі розробника
    console.group('🚨 ErrorBoundary: Зафіксовано системний критичний збій');
    console.error('Об\'єкт помилки:', error);
    console.error('Метадані React:', errorInfo);
    console.table(errorReport);
    console.groupEnd();

    // Персистентне збереження логів у локальному сховищі браузера
    this.saveErrorToLocalStorage(errorReport);

    this.setState({
      error,
      errorInfo,
    });
  }

  /**
   * Формування комплексного звіту про інцидент.
   */
  private generateErrorReport(error: Error, errorInfo: ErrorInfo): ErrorReport {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const memory =
      (performance as any).memory
        ? `${Math.round((performance as any).memory.usedJSHeapSize / 1048576)} MB / ${Math.round((performance as any).memory.jsHeapSizeLimit / 1048576)} MB`
        : null;

    return {
      timestamp: new Date().toISOString(),
      sessionDuration: this.formatDuration(sessionDuration),
      error: error.toString(),
      stack: error.stack || 'Стек викликів відсутній',
      componentStack: errorInfo.componentStack.trim(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      memory,
      url: window.location.href,
    };
  }

  /**
   * Перетворення часового інтервалу у людиночитаний формат.
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}г ${minutes % 60}хв ${seconds % 60}с`;
    } else if (minutes > 0) {
      return `${minutes}хв ${seconds % 60}с`;
    } else {
      return `${seconds}с`;
    }
  }

  /**
   * Архівування звіту про помилку в localStorage із обмеженням глибини історії.
   */
  private saveErrorToLocalStorage(errorReport: ErrorReport): void {
    try {
      const errors = JSON.parse(localStorage.getItem('entropia-errors') || '[]');
      errors.push(errorReport);
      // Збереження лише останніх 10 інцидентів для запобігання переповненню сховища
      const recentErrors = errors.slice(-10);
      localStorage.setItem('entropia-errors', JSON.stringify(recentErrors));
    } catch (e) {
      console.warn('Неможливо здійснити запис інциденту в localStorage:', e);
    }
  }

  /**
   * Експорт звіту про помилку в буфер обміну для подальшої передачі розробникам.
   */
  private copyErrorReport = (): void => {
    if (!this.state.error || !this.state.errorInfo) return;

    const report = this.generateErrorReport(
      this.state.error,
      this.state.errorInfo
    );

    const reportText = `
ENTROPIA 3D: ЗВІТ ПРО СИСТЕМНИЙ ЗБІЙ
===================================

📅 Часова мітка: ${report.timestamp}
⏱️  Тривалість сесії: ${report.sessionDuration}
🌐 Локація (URL): ${report.url}

ДЕТАЛІ ПОМИЛКИ
--------------
${report.error}

СТЕК ВИКЛИКІВ (STACK TRACE)
---------------------------
${report.stack}

ІЄРАРХІЯ КОМПОНЕНТІВ (COMPONENT STACK)
--------------------------------------
${report.componentStack}

СИСТЕМНІ МЕТАДАНІ
-----------------
Середовище (User Agent): ${report.userAgent}
Платформа: ${report.platform}
Роздільна здатність: ${report.screenResolution}
Область перегляду: ${report.viewport}
${report.memory ? `Стан пам'яті: ${report.memory}` : ''}

Цей звіт сформовано автоматично модулем Error Boundary проекту Entropia 3D.
Будь ласка, надішліть цей звіт за адресою: https://github.com/dogmator/entropia/issues
    `.trim();

    navigator.clipboard
      .writeText(reportText)
      .then(() => {
        alert('Діагностичний звіт успішно скопійовано до буфера обміну.');
      })
      .catch((err) => {
        console.error('Помилка операції копіювання:', err);
        // Резервний механізм виводу тексту звіту
        prompt('Будь ласка, скопіюйте звіт вручну:', reportText);
      });
  };

  /**
   * Скидання критичного стану та перезавантаження середовища.
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      timestamp: null,
    });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      const report = this.generateErrorReport(
        this.state.error,
        this.state.errorInfo
      );

      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/95 z-50 p-4">
          <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Секція заголовку критичного сповіщення */}
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-red-500/20">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-black text-red-400 tracking-wide">
                  Виявлено критичний збій
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Виконання симуляції призупинено через непередбачуваний виняток
                </p>
              </div>
              <div className="text-xs text-gray-600">
                {report.timestamp.split('T')[1].split('.')[0]}
              </div>
            </div>

            {/* Блок системної телеметрії */}
            <div className="bg-black/30 rounded-xl p-4 mb-4 text-xs space-y-2">
              <div className="flex justify-between text-gray-500">
                <span>Тривалість сесії:</span>
                <span className="text-gray-400 font-mono">
                  {report.sessionDuration}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Viewport (Область перегляду):</span>
                <span className="text-gray-400 font-mono">
                  {report.viewport}
                </span>
              </div>
              {report.memory && (
                <div className="flex justify-between text-gray-500">
                  <span>Використання пам'яті:</span>
                  <span className="text-gray-400 font-mono">
                    {report.memory}
                  </span>
                </div>
              )}
            </div>

            {/* Деталізація ідентифікованої помилки */}
            <div className="bg-black/50 rounded-xl p-4 mb-4 font-mono text-sm text-red-300 max-h-48 overflow-y-auto custom-scrollbar">
              <div className="mb-2 text-xs text-gray-500 uppercase tracking-widest">
                Опис винятку:
              </div>
              <div className="whitespace-pre-wrap break-all">
                {this.state.error.toString()}
              </div>
            </div>

            {/* Технічні звіти (Stacks) */}
            <div className="space-y-3 mb-6">
              <details className="bg-black/30 rounded-xl overflow-hidden">
                <summary className="cursor-pointer p-4 hover:bg-black/50 transition-colors text-sm text-gray-400 font-semibold">
                  📚 JavaScript Stack Trace
                </summary>
                <pre className="p-4 text-xs text-gray-500 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {report.stack}
                </pre>
              </details>

              <details className="bg-black/30 rounded-xl overflow-hidden">
                <summary className="cursor-pointer p-4 hover:bg-black/50 transition-colors text-sm text-gray-400 font-semibold">
                  🧩 React Component Stack
                </summary>
                <pre className="p-4 text-xs text-gray-500 font-mono overflow-x-auto whitespace-pre-wrap">
                  {report.componentStack}
                </pre>
              </details>

              <details className="bg-black/30 rounded-xl overflow-hidden">
                <summary className="cursor-pointer p-4 hover:bg-black/50 transition-colors text-sm text-gray-400 font-semibold">
                  💻 Системне оточення
                </summary>
                <div className="p-4 text-xs text-gray-500 font-mono space-y-1">
                  <div>
                    <span className="text-gray-600">Платформа:</span>{' '}
                    {report.platform}
                  </div>
                  <div className="break-all">
                    <span className="text-gray-600">User Agent:</span>{' '}
                    {report.userAgent}
                  </div>
                </div>
              </details>
            </div>

            {/* Керуючі елементи відновлення */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={this.handleReset}
                className="flex-1 h-12 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 min-w-[200px]"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Перезапустити середовище
              </button>
              <button
                onClick={this.copyErrorReport}
                className="flex-1 h-12 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 min-w-[200px]"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Експортувати звіт
              </button>
              <button
                onClick={() =>
                  window.open(
                    'https://github.com/dogmator/entropia/issues',
                    '_blank'
                  )
                }
                className="flex-1 h-12 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 min-w-[200px]"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Повідомити про інцидент
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
