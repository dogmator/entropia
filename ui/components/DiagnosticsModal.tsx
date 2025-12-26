import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { SimulationStats, PerformanceMetrics } from '../../types';
import { PerformanceHelpers } from '../../core/utils/PerformanceUtils';
import { logger, LogLevel } from '../../core/services/Logger';
import type { LogEntry } from '../../core/services/Logger';

// Допоміжні функції для уникнення дублювання
const formatNumber = (value: number | undefined, defaultValue: number, decimals: number = 0) => 
  (value ?? defaultValue).toFixed(decimals);

const getWorldArea = (worldSize: number | undefined) => {
  const size = worldSize ?? 1000;
  const areaInSquareUnits = size * size;
  
  // Визначаємо одиниці виміру в залежності від розміру
  if (areaInSquareUnits >= 1000000) {
    return (areaInSquareUnits / 1000000).toFixed(2) + ' M²'; // Для великих світів
  } else if (areaInSquareUnits >= 1000) {
    return (areaInSquareUnits / 1000).toFixed(1) + ' K²'; // Для середніх світів
  } else {
    return areaInSquareUnits.toString() + ' u²'; // Для малих світів
  }
};

const getCameraPosition = (stats: SimulationStats) => ({
  x: formatNumber(stats.cameraX, 0, 0),
  y: formatNumber(stats.cameraY, 0, 0),
  z: formatNumber(stats.cameraZ, 0, 0),
});

const getCameraTarget = (stats: SimulationStats) => ({
  x: formatNumber(stats.targetX, 0, 0),
  y: formatNumber(stats.targetY, 0, 0),
  z: formatNumber(stats.targetZ, 0, 0),
});

// Константи для уникнення magic numbers
const DEFAULT_WORLD_SIZE = 1000;
const DEFAULT_CAMERA_FOV = 60;
const DEFAULT_CAMERA_ASPECT = 1;
const DEFAULT_ZOOM = 1;

// Мемоізовані компоненти для оптимізації рендерингу
const MetricCard = React.memo(({ title, value, unit, color, trend }: {
  title: string;
  value: number;
  unit: string;
  color: string;
  trend?: number;
}) => (
  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-gray-400 uppercase tracking-widest">{title}</span>
      <span className={`text-lg font-mono font-bold ${color}`}>
        {value}{unit}
      </span>
    </div>
    {trend !== undefined && (
      <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-yellow-500 transition-all duration-300"
          style={{ width: `${Math.min(100, trend)}%` }}
        />
      </div>
    )}
  </div>
));

MetricCard.displayName = 'MetricCard';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStats: SimulationStats;
  performanceHistory: PerformanceMetrics[];
  memoryStats: MemoryStats;
}

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  used: number;
  total: number;
  limit: number;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  fps: number;
  tps: number;
  timestamp: number;
  frameTime: number;
  simulationTime: number;
  entityCount: number;
  memoryUsage: number;
  drawCalls: number;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  currentStats,
  performanceHistory,
  memoryStats
}) => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
  const [detailedLogs, setDetailedLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'performance' | 'memory' | 'entities' | 'logs' | 'world'>('performance');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const logsSubscriptionRef = useRef<(() => void) | null>(null);

  // Оптимізований збір метрик з requestAnimationFrame
  const collectSystemMetrics = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      const now = Date.now();
      const performance = performanceHistory[performanceHistory.length - 1];
      
      const newMetric: SystemMetrics = {
        timestamp: now,
        fps: performance?.fps || 0,
        tps: performance?.tps || 0,
        frameTime: performance?.frameTime || 0,
        simulationTime: performance?.simulationTime || 0,
        entityCount: currentStats.preyCount + currentStats.predatorCount,
        memoryUsage: memoryStats.usedJSHeapSize,
        drawCalls: performance?.drawCalls || 0,
        cpu: 0, // TODO: Реалізувати вимірювання CPU
        memory: memoryStats.usedJSHeapSize || 0
      };

      setSystemMetrics(prev => {
        const updated = [...prev, newMetric];
        return updated.slice(-60); // Останні 60 секунд для оптимізації пам'яті
      });
    });
  }, [performanceHistory, memoryStats, currentStats.preyCount, currentStats.predatorCount]);

  useEffect(() => {
    if (isOpen) {
      // Збираємо метрики одразу при відкритті
      collectSystemMetrics();
      // Встановлюємо інтервал для регулярного оновлення
      intervalRef.current = setInterval(collectSystemMetrics, 1000);
    } else {
      // Очищуємо при закритті
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Очищуємо метрики для економії пам'яті
      setSystemMetrics([]);
    }
    
    // Очищення при unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isOpen, collectSystemMetrics]);

  // Мемоізовані утиліти з використанням спільних функцій
  const formatBytes = useMemo(() => PerformanceHelpers.format.formatBytes, []);
  const getPerformanceColor = useMemo(() => PerformanceHelpers.color.getPerformanceColor, []);
  const getMemoryColor = useMemo(() => PerformanceHelpers.color.getMemoryColor, []);
  const getFPSColor = useMemo(() => PerformanceHelpers.color.getFPSColor, []);
  const getTPSColor = useMemo(() => PerformanceHelpers.color.getTPSColor, []);
  const getFrameTimeColor = useMemo(() => PerformanceHelpers.color.getFrameTimeColor, []);

  // Очищення при unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (logsSubscriptionRef.current) {
        logsSubscriptionRef.current();
        logsSubscriptionRef.current = null;
      }
    };
  }, []);

  // Підписка на логи при відкритті модального вікна
  useEffect(() => {
    if (isOpen) {
      // Отримуємо поточні логи
      setDetailedLogs(logger.getLogs());
      
      // Підписуємось на оновлення логів
      logsSubscriptionRef.current = logger.subscribe((logs) => {
        setDetailedLogs(logs.slice(-100)); // Останні 100 записів
      });
      
      // Додаємо тестовий лог
      logger.info('Diagnostics modal opened', 'UI', { timestamp: Date.now() });
    } else {
      // Відписуємось при закритті
      if (logsSubscriptionRef.current) {
        logsSubscriptionRef.current();
        logsSubscriptionRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
        <div className="flex border-b border-white/10 overflow-x-auto custom-scrollbar">
          {(['performance', 'memory', 'entities', 'world', 'logs'] as const).map((tab) => {
            const icons = {
              performance: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
              memory: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              ),
              entities: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ),
              world: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              logs: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )
            };
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2 ${
                  activeTab === tab
                    ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {icons[tab]}
                <span className="hidden sm:inline">
                  {tab === 'performance' && 'Продуктивність'}
                  {tab === 'memory' && 'Пам\'ять'}
                  {tab === 'entities' && 'Сутності'}
                  {tab === 'world' && 'Світ'}
                  {tab === 'logs' && 'Журнали'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(95vh-180px)] sm:max-h-[calc(90vh-200px)] custom-scrollbar">
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* Real-time Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="FPS"
                value={currentStats.performance?.fps || 0}
                unit=""
                color={getFPSColor(currentStats.performance?.fps || 0)}
                trend={Math.min(100, (currentStats.performance?.fps || 0) / 60 * 100)}
              />
              <MetricCard
                title="TPS"
                value={currentStats.performance?.tps || 0}
                unit=""
                color={getTPSColor(currentStats.performance?.tps || 0)}
                trend={Math.min(100, (currentStats.performance?.tps || 0) / 60 * 100)}
              />
              <MetricCard
                title="Frame Time"
                value={parseFloat((currentStats.performance?.frameTime || 0).toFixed(1))}
                unit="ms"
                color={getFrameTimeColor(currentStats.performance?.frameTime || 0)}
                trend={Math.min(100, (currentStats.performance?.frameTime || 0) / 16.67 * 100)}
              />
              <MetricCard
                title="Entities"
                value={currentStats.performance?.entityCount || 0}
                unit=""
                color="text-purple-400"
              />
            </div>

              {/* Performance Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart
                title="FPS/TPS Dynamics"
                data={performanceHistory.slice(-30)}
                lines={[
                  { name: 'FPS', dataKey: 'fps', stroke: '#10b981' },
                  { name: 'TPS', dataKey: 'tps', stroke: '#3b82f6' }
                ]}
              />
              <PerformanceChart
                title="Frame Time Analysis"
                data={performanceHistory.slice(-30)}
                area
                lines={[{ name: 'Frame Time', dataKey: 'frameTime', stroke: '#f59e0b' }]}
              />
            </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-6">
              {/* Memory Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Використано</span>
                    <span className={`text-lg font-mono font-bold ${getMemoryColor((memoryStats.usedJSHeapSize / memoryStats.jsHeapSizeLimit) * 100)}`}>
                      {formatBytes(memoryStats.usedJSHeapSize)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-yellow-500 transition-all duration-300"
                      style={{ width: `${(memoryStats.usedJSHeapSize / memoryStats.jsHeapSizeLimit) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Загалом виділено</span>
                    <span className="text-lg font-mono font-bold text-blue-400">
                      {formatBytes(memoryStats.totalJSHeapSize)}
                    </span>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Ліміт</span>
                    <span className="text-lg font-mono font-bold text-purple-400">
                      {formatBytes(memoryStats.jsHeapSizeLimit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Memory Chart */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Memory Usage Over Time</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={systemMetrics.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#111" />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #222', borderRadius: '8px' }}
                      labelFormatter={(value) => `Time: ${new Date(value).toLocaleTimeString()}`}
                    />
                    <Area name="Memory %" type="monotone" dataKey="memory" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'entities' && (
            <div className="space-y-6">
              {/* Entity Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Травоядные</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      {currentStats.preyCount}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Середня енергія: {currentStats.avgPreyEnergy.toFixed(1)}
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Хищники</span>
                    <span className="text-lg font-mono font-bold text-red-400">
                      {currentStats.predatorCount}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Середня енергія: {currentStats.avgPredatorEnergy.toFixed(1)}
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Ресурсы</span>
                    <span className="text-lg font-mono font-bold text-yellow-400">
                      {currentStats.foodCount}
                    </span>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Ризик вимирання</span>
                    <span className={`text-lg font-mono font-bold ${currentStats.extinctionRisk > 0.7 ? 'text-red-400' : currentStats.extinctionRisk > 0.4 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {Math.round(currentStats.extinctionRisk * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Population Dynamics */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Популяційна динаміка</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Народжень загалом:</span>
                      <span className="text-emerald-400 font-mono">{currentStats.totalBirths}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Смертей загалом:</span>
                      <span className="text-red-400 font-mono">{currentStats.totalDeaths}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Макс. вік:</span>
                      <span className="text-purple-400 font-mono">{currentStats.maxAge}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Макс. покоління:</span>
                      <span className="text-blue-400 font-mono">{currentStats.maxGeneration}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Середня енергія:</span>
                      <span className="text-yellow-400 font-mono">{currentStats.avgEnergy.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Коефіцієнт виживання:</span>
                      <span className="text-cyan-400 font-mono">
                        {currentStats.totalBirths > 0 ? ((currentStats.totalBirths - currentStats.totalDeaths) / currentStats.totalBirths * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'world' && (
            <div className="space-y-6">
              {/* World Geometry */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Розмір світу</span>
                    <span className="text-lg font-mono font-bold text-blue-400">
                      {formatNumber(currentStats.worldSize, DEFAULT_WORLD_SIZE)}×{formatNumber(currentStats.worldSize, DEFAULT_WORLD_SIZE)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Площа: {getWorldArea(currentStats.worldSize)} M²
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Позиція камери</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      ({getCameraPosition(currentStats).x}, {getCameraPosition(currentStats).y}, {getCameraPosition(currentStats).z})
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    X: {getCameraPosition(currentStats).x}, Y: {getCameraPosition(currentStats).y}, Z: {getCameraPosition(currentStats).z}
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Ціль камери</span>
                    <span className="text-lg font-mono font-bold text-blue-400">
                      ({getCameraTarget(currentStats).x}, {getCameraTarget(currentStats).y}, {getCameraTarget(currentStats).z})
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    X: {getCameraTarget(currentStats).x}, Y: {getCameraTarget(currentStats).y}, Z: {getCameraTarget(currentStats).z}
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Масштаб</span>
                    <span className="text-lg font-mono font-bold text-purple-400">
                      {formatNumber(currentStats.zoom, DEFAULT_ZOOM, 2)}×
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Дистанція: {formatNumber(currentStats.cameraDistance, 0, 0)}
                  </div>
                  <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300"
                      style={{ width: `${Math.min((currentStats.zoom ?? DEFAULT_ZOOM) * 50, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Параметри камери</span>
                    <span className="text-lg font-mono font-bold text-cyan-400">
                      {formatNumber(currentStats.cameraFov, DEFAULT_CAMERA_FOV, 0)}°
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    FOV: {formatNumber(currentStats.cameraFov, DEFAULT_CAMERA_FOV, 0)}° | Aspect: {formatNumber(currentStats.cameraAspect, DEFAULT_CAMERA_ASPECT, 2)}
                  </div>
                </div>
              </div>

              {/* World Zones */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Екологічні зони</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full"></div>
                    </div>
                    <div className="text-xs text-gray-400">Зона росту</div>
                    <div className="text-sm font-mono text-emerald-400">{currentStats.growthZones || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <div className="w-6 h-6 bg-yellow-500 rounded-full"></div>
                    </div>
                    <div className="text-xs text-gray-400">Нейтральні зони</div>
                    <div className="text-sm font-mono text-yellow-400">{currentStats.neutralZones || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-red-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <div className="w-6 h-6 bg-red-500 rounded-full"></div>
                    </div>
                    <div className="text-xs text-gray-400">Небезпечні зони</div>
                    <div className="text-sm font-mono text-red-400">{currentStats.dangerZones || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
                    </div>
                    <div className="text-xs text-gray-400">Всього зон</div>
                    <div className="text-sm font-mono text-purple-400">{currentStats.totalZones || 0}</div>
                  </div>
                </div>
              </div>

              {/* Spatial Grid Information */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Просторова сітка</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Розмір комірки:</span>
                      <span className="text-blue-400 font-mono">{currentStats.cellSize || 50}×{currentStats.cellSize || 50}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Кількість комірок:</span>
                      <span className="text-emerald-400 font-mono">{currentStats.totalCells || 400}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Заповнені комірки:</span>
                      <span className="text-yellow-400 font-mono">{currentStats.occupiedCells || 0}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Середня щільність:</span>
                      <span className="text-purple-400 font-mono">{currentStats.avgDensity || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Макс. щільність:</span>
                      <span className="text-red-400 font-mono">{currentStats.maxDensity || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ефективність сітки:</span>
                      <span className="text-cyan-400 font-mono">{currentStats.gridEfficiency || 95}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* World Statistics */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Статистика світу</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400 mb-1">{currentStats.foodSpawnRate || 5}</div>
                    <div className="text-xs text-gray-400">Швидкість появи їжі</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-1">{currentStats.obstacleCount || 0}</div>
                    <div className="text-xs text-gray-400">Перешкоди</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400 mb-1">{currentStats.worldAge || 0}</div>
                    <div className="text-xs text-gray-400">Вік світу (хв)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400 mb-1">{currentStats.activeZones || 0}</div>
                    <div className="text-xs text-gray-400">Активні зони</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Системні журнали</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {detailedLogs.length === 0 ? (
                    <div className="text-gray-500 text-sm">Журнали тимчасово недоступні</div>
                  ) : (
                    detailedLogs.map((log, index) => (
                      <div key={index} className={`text-xs p-2 rounded ${log.level === 'error' ? 'bg-red-950/30 text-red-400' : log.level === 'warning' ? 'bg-yellow-950/30 text-yellow-400' : 'bg-emerald-950/30 text-emerald-400'}`}>
                        <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="ml-2">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Мемоізований компонент для графіків
const PerformanceChart = React.memo(({ 
  title, 
  data, 
  lines, 
  area = false 
}: {
  title: string;
  data: any[];
  lines: { name: string; dataKey: string; stroke: string }[];
  area?: boolean;
}) => (
  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
    <h3 className="text-sm font-medium text-gray-300 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={200}>
      {area ? (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#111" />
          <XAxis dataKey="timestamp" hide />
          <YAxis hide />
          <Tooltip
            contentStyle={{ backgroundColor: '#000', border: '1px solid #222', borderRadius: '8px' }}
          />
          {lines.map((line, index) => (
            <Area
              key={line.name}
              name={line.name}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              fill={line.stroke}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#111" />
          <XAxis dataKey="timestamp" hide />
          <YAxis hide />
          <Tooltip
            contentStyle={{ backgroundColor: '#000', border: '1px solid #222', borderRadius: '8px' }}
            labelFormatter={(value) => `Time: ${value}`}
          />
          {lines.map((line) => (
            <Line
              key={line.name}
              name={line.name}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  </div>
));

PerformanceChart.displayName = 'PerformanceChart';
