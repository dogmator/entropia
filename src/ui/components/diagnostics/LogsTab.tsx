import React from 'react';

import type { LogEntry } from '@/core/services/Logger';

interface LogsTabProps {
    detailedLogs: LogEntry[];
}


const getLogStyle = (level: string) => {
    switch (level) {
        case 'error': return 'bg-red-950/30 text-red-400';
        case 'warning': return 'bg-yellow-950/30 text-yellow-400';
        default: return 'bg-emerald-950/30 text-emerald-400';
    }
};

export const LogsTab: React.FC<LogsTabProps> = ({ detailedLogs }) => {
    return (
        <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-sm font-medium text-gray-300 mb-4">Системні журнали</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                    {detailedLogs.length === 0 ? (
                        <div className="text-gray-500 text-sm">Журнали тимчасово недоступні</div>
                    ) : (
                        detailedLogs.map((log, index) => (
                            <div key={index} className={`text-xs p-2 rounded ${getLogStyle(log.level)}`}>
                                <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span className="ml-2">{log.message}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
