/**
 * Точка входу в аплікаційне середовище Entropia 3D.
 * Виконує ініціалізацію віртуальної структури вузлів React та монтування кореневого компонента в DOM.
 */

import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { logger } from '@/core';

import { App } from './App';

// Активація віддаленого логування лише за явним opt-in, щоб уникнути шуму в браузері без log-server.
const shouldEnableRemoteLogging = localStorage.getItem('entropia:remoteLogging') === '1';
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
