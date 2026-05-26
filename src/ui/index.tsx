/**
 * Точка входу в аплікаційне середовище Entropia 3D.
 * Виконує ініціалізацію віртуальної структури вузлів React та монтування кореневого компонента в DOM.
 */

import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { logger } from '@/core';
import { resolveRemoteLoggingEnabled } from '@/ui/utils/remoteLogging';

import { App } from './App';

// Dev: remote logging увімкнено за замовчуванням.
// Override: localStorage['entropia:remoteLogging']='0' (disable) або '1' (enable).
const isDevelopment = import.meta.env.DEV === true;
const shouldEnableRemoteLogging = resolveRemoteLoggingEnabled(localStorage, isDevelopment);
logger.setRemoteLogging(shouldEnableRemoteLogging);

/** Пошук кореневого контейнера в структурі документа. */
const rootElement = document.getElementById('root');

if (!rootElement) {
  /** Критична помилка ініціалізації при відсутності цільового контейнера. */
  throw new Error("Системна помилка: цільовий DOM-елемент 'root' не ідентифіковано.");
}

/** Створення екземпляра React Root та активація StrictMode для виявлення потенційних дефектів життєвого циклу. */
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
