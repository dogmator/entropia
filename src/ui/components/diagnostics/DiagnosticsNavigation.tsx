import React from 'react';

export type TabKey = 'performance' | 'memory' | 'entities' | 'world' | 'logs';

interface DiagnosticsNavigationProps {
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
}

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
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

const TAB_NAMES: Record<TabKey, string> = {
    performance: 'Продуктивність',
    memory: 'Пам\'ять',
    entities: 'Сутності',
    world: 'Світ',
    logs: 'Журнали'
};

export const DiagnosticsNavigation: React.FC<DiagnosticsNavigationProps> = ({ activeTab, onTabChange }) => {
    return (
        <div className="flex border-b border-white/10 overflow-x-auto custom-scrollbar">
            {(Object.keys(TAB_ICONS) as TabKey[]).map((tab) => (
                <button
                    key={tab}
                    onClick={() => onTabChange(tab)}
                    className={`flex-shrink-0 px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2 ${activeTab === tab
                        ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    {TAB_ICONS[tab]}
                    <span className="hidden sm:inline">
                        {TAB_NAMES[tab]}
                    </span>
                </button>
            ))}
        </div>
    );
};
