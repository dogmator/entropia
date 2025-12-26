export interface SettingsSliderProps<T> {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    param: keyof T;
    onChange: (param: keyof T, val: number) => void;
    colorClass?: string;
}

export const SettingsSlider = <T,>({
    label,
    value,
    min,
    max,
    step,
    param,
    onChange,
    colorClass = 'accent-emerald-500',
}: SettingsSliderProps<T>) => (
    <div className="group flex flex-col gap-1.5 mb-4 last:mb-0">
        <div className="flex justify-between items-center text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">
            <span className="font-bold">{label}</span>
            <span className="font-mono font-black text-white bg-white/5 px-2 py-0.5 rounded text-[10px] sm:text-[9px] min-w-[36px] text-center">
                {value.toFixed(step >= 1 ? 0 : 2)}
            </span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(param, parseFloat(e.target.value))}
            className={`w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer ${colorClass} hover:bg-white/20 transition-all touch-manipulation`}
        />
    </div>
);
