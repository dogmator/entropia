/**
 * Skeleton luminescent loader for Sidebar module.
 *
 * Used as an inertial placeholder during asynchronous initialization (lazy loading) of the Sidebar component.
 * Mimics control panel architecture, including analytics blocks, population dynamics charts, and system controllers.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import React from 'react';

import { UI_CONFIG } from '@/config';


// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const SkeletonHeader = (): React.JSX.Element => (
  <div className="p-6 border-b border-white/5">
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 w-32 bg-gray-700/50 rounded animate-pulse" />
      <div className="h-6 w-16 bg-gray-700/50 rounded animate-pulse" />
    </div>
    <div className="h-4 w-48 bg-gray-700/30 rounded animate-pulse" />
  </div>
);

const SkeletonControls = (): React.JSX.Element => (
  <div className="space-y-4">
    <div className="h-12 bg-gray-800/50 rounded-xl animate-pulse" />
    <div className="grid grid-cols-2 gap-3">
      <div className="h-12 bg-gray-800/50 rounded-xl animate-pulse" />
      <div className="h-12 bg-gray-800/50 rounded-xl animate-pulse" />
    </div>
  </div>
);

const SkeletonStats = (): React.JSX.Element => (
  <div className="grid grid-cols-2 gap-3">
    {Array.from({ length: UI_CONFIG.SKELETON.COUNTS.STATS }).map((_, i) => (
      <div
        key={i}
        className="bg-gray-800/30 rounded-xl p-4 border border-white/5 space-y-3 animate-pulse"
        style={{ animationDelay: `${String(i * UI_CONFIG.SKELETON.ANIMATION.DELAY_STEP_STATS)}ms` }}
      >
        <div className="h-3 w-20 bg-gray-700/50 rounded" />
        <div className="h-8 w-16 bg-gray-700/50 rounded" />
      </div>
    ))}
  </div>
);

const SkeletonChart = (): React.JSX.Element => (
  <div className="bg-gray-800/30 rounded-xl p-4 border border-white/5 space-y-4">
    <div className="h-4 w-32 bg-gray-700/50 rounded animate-pulse" />
    <div className="h-48 bg-gray-700/20 rounded-lg relative overflow-hidden">
      <div className="absolute inset-0">
        <svg className="w-full h-full opacity-20">
          <path
            d="M 0,120 Q 50,80 100,100 T 200,90 T 300,110 T 400,95"
            fill="none"
            stroke="rgba(16, 185, 129, 0.3)"
            strokeWidth="2"
            className="animate-pulse"
          />
          <path
            d="M 0,140 Q 50,100 100,120 T 200,110 T 300,130 T 400,115"
            fill="none"
            stroke="rgba(239, 68, 68, 0.3)"
            strokeWidth="2"
            className="animate-pulse"
            style={{ animationDelay: `${String(UI_CONFIG.SKELETON.ANIMATION.DELAY_POPULATION_SECONDARY)}ms` }}
          />
        </svg>
      </div>
    </div>
  </div>
);

const SkeletonTelemetry = (): React.JSX.Element => (
  <div className="space-y-3">
    {Array.from({ length: UI_CONFIG.SKELETON.COUNTS.TELEMETRY }).map((_, i) => (
      <div
        key={i}
        className="flex items-center justify-between bg-gray-800/20 rounded-lg p-3 animate-pulse"
        style={{ animationDelay: `${String(i * UI_CONFIG.SKELETON.ANIMATION.DELAY_STEP_TELEMETRY)}ms` }}
      >
        <div className="h-3 w-24 bg-gray-700/50 rounded" />
        <div className="h-3 w-16 bg-gray-700/50 rounded" />
      </div>
    ))}
  </div>
);

const SkeletonFooter = (): React.JSX.Element => (
  <div className="p-6 border-t border-white/5">
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
      <div className="h-3 w-32 bg-gray-700/50 rounded" />
    </div>
  </div>
);

export const SidebarSkeleton: React.FC = (): React.JSX.Element => {
  return (
    <div className="fixed top-0 right-0 w-full sm:w-[420px] h-full z-20 flex flex-col bg-black/60 backdrop-blur-2xl border-l border-white/5">
      <SkeletonHeader />
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <SkeletonControls />
        <SkeletonStats />
        <SkeletonChart />
        <SkeletonTelemetry />
      </div>
      <SkeletonFooter />
    </div>
  );
};
