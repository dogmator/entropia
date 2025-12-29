
export const SectionHeader = ({ title, colorClass = 'text-emerald-400', borderColorClass = 'bg-emerald-500/20' }: { title: string, colorClass?: string, borderColorClass?: string }) => (
    <h3 className={`text-[10px] sm:text-[9px] ${colorClass} font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-3`}>
        <div className={`h-px flex-1 ${borderColorClass}`} />
        {title}
        <div className={`h-px flex-1 ${borderColorClass}`} />
    </h3>
);

export const ToggleButton = ({ label, description, active, onToggle, colorClass = 'bg-emerald-500' }: { label: string, description?: string, active: boolean, onToggle: () => void, colorClass?: string }) => (
    <div className="flex justify-between items-center mb-4 last:mb-0">
        <div className="flex flex-col">
            <span className="text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">{label}</span>
            {description && <span className="text-[8px] sm:text-[7px] text-gray-600">{description}</span>}
        </div>
        <button
            onClick={onToggle}
            className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${active ? colorClass : 'bg-white/10'}`}
        >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-lg ${active ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
    </div>
);
