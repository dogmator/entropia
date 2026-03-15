interface IconProps {
    className?: string;
    strokeWidth?: number;
}

const ICON_DEFAULTS = {
    CLOSE: { className: "w-5 h-5", strokeWidth: 2 } as const,
    RESET: { className: "w-4 h-4", strokeWidth: 2.5 } as const,
    DIAGNOSTICS: { className: "w-4 h-4", strokeWidth: 2 } as const,
    BACK: { className: "w-4 h-4", strokeWidth: 3 } as const,
    ALERT: { className: "w-8 h-8", strokeWidth: 2 } as const,
    COPY: { className: "w-5 h-5", strokeWidth: 2.5 } as const,
} as const;

export const Icons = {
    Close: ({ className = ICON_DEFAULTS.CLOSE.className, strokeWidth = ICON_DEFAULTS.CLOSE.strokeWidth }: IconProps) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    Reset: ({ className = ICON_DEFAULTS.RESET.className, strokeWidth = ICON_DEFAULTS.RESET.strokeWidth }: IconProps) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    ),
    Diagnostics: ({ className = ICON_DEFAULTS.DIAGNOSTICS.className, strokeWidth = ICON_DEFAULTS.DIAGNOSTICS.strokeWidth }: IconProps) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
    ),
    Back: ({ className = ICON_DEFAULTS.BACK.className, strokeWidth = ICON_DEFAULTS.BACK.strokeWidth }: IconProps) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M15 19l-7-7 7-7" />
        </svg>
    ),
    Alert: ({ className = ICON_DEFAULTS.ALERT.className, strokeWidth = ICON_DEFAULTS.ALERT.strokeWidth }: IconProps) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    ),
    Copy: ({ className = ICON_DEFAULTS.COPY.className, strokeWidth = ICON_DEFAULTS.COPY.strokeWidth }: IconProps) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    ),
};
