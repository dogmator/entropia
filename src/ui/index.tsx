/**
 * Точка входу в аплікаційне середовище Entropia 3D.
 * Виконує ініціалізацію віртуальної структури вузлів React та монтування кореневого компонента в DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './index.css';

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
