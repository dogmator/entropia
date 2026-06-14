/**
 * Entry point for the Entropia 3D application environment.
 * Performs initialization of the React virtual node structure and mounts the root component to the DOM.
 */

import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { logger } from '@/core';
import { t } from '@/i18n';
import { resolveRemoteLoggingEnabled } from '@/ui/utils/remoteLogging';

import { App } from './App';

// Dev: remote logging enabled by default.
// Override: localStorage['entropia:remoteLogging']='0' (disable) or '1' (enable).
const isDevelopment = import.meta.env.DEV;
const shouldEnableRemoteLogging = resolveRemoteLoggingEnabled(localStorage, isDevelopment);
logger.setRemoteLogging(shouldEnableRemoteLogging);

/** Search for root container in document structure. */
const rootElement = document.getElementById('root');

if (!rootElement) {
  /** Critical initialization error if target container is missing. */
  throw new Error(t.errors.rootNotFound);
}

/** Creating React Root instance and activating StrictMode to detect potential lifecycle defects. */
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
