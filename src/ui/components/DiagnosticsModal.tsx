import React, { useState } from 'react';

import type { MemoryStats, PerformanceMetrics, SimulationStats } from '@/types';

import { DiagnosticsNavigation, type TabKey } from './diagnostics/DiagnosticsNavigation';
import { EntitiesTab } from './diagnostics/EntitiesTab';
import { useDetailedLogs, useSystemMetrics } from './diagnostics/hooks';
import { LogsTab } from './diagnostics/LogsTab';
import { MemoryTab } from './diagnostics/MemoryTab';
import { PerformanceTab } from './diagnostics/PerformanceTab';
import { WorldTab } from './diagnostics/WorldTab';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStats: SimulationStats;
  performanceHistory: PerformanceMetrics[];
  memoryStats: MemoryStats;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  currentStats,
  performanceHistory,
  memoryStats
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('performance');
  const systemMetrics = useSystemMetrics(isOpen, performanceHistory, memoryStats, currentStats);
  const detailedLogs = useDetailedLogs(isOpen);

  if (!isOpen) { return null; }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-black/90 border border-white/10 rounded-2xl w-full max-w-4xl sm:max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
          <div className="flex items-center gap-2 sm:gap-4">
            <h2 className="text-lg sm:text-2xl font-black text-emerald-400">Діагностика системи</h2>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>Реальний час</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <DiagnosticsNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content */}
        <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(95vh-180px)] sm:max-h-[calc(90vh-200px)] custom-scrollbar">
          {activeTab === 'performance' && (
            <PerformanceTab
              currentStats={currentStats}
              performanceHistory={performanceHistory}
            />
          )}

          {activeTab === 'memory' && (
            <MemoryTab
              memoryStats={memoryStats}
              systemMetrics={systemMetrics}
            />
          )}

          {activeTab === 'entities' && (
            <EntitiesTab
              currentStats={currentStats}
            />
          )}

          {activeTab === 'world' && (
            <WorldTab
              currentStats={currentStats}
            />
          )}

          {activeTab === 'logs' && (
            <LogsTab
              detailedLogs={detailedLogs}
            />
          )}
        </div>
      </div>
    </div>
  );
};
