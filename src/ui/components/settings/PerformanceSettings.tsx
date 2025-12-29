import { useSimulation } from '../../context/SimulationContext';
import { SettingsSlider } from '../SettingsSlider';
import { useSettings } from './SettingsContext';
import { SectionHeader, ToggleButton } from './Shared';

export const PerformanceSettings = () => {
    const { config, toggle, applyPreset } = useSettings();
    const { autoRotate, setAutoRotate, autoRotateSpeed, setAutoRotateSpeed } = useSimulation();

    return (
        <section>
            <SectionHeader title="⚡ Графіка" colorClass="text-cyan-400" borderColorClass="bg-cyan-500/20" />

            {/* Presets */}
            <div className="mb-6">
                <div className="text-[10px] sm:text-[9px] text-gray-400 uppercase tracking-widest mb-2 font-bold">Профіль якості</div>
                <div className="grid grid-cols-4 gap-2 mb-1">
                    {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((quality) => (
                        <button
                            key={quality}
                            onClick={() => applyPreset(quality)}
                            className={`h-9 rounded-lg text-[9px] font-bold transition-all duration-200 touch-manipulation ${config.graphicsQuality === quality
                                ? 'bg-cyan-500/30 text-cyan-300 ring-2 ring-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {quality === 'LOW' ? '⚡ LOW' : null}
                            {quality === 'MEDIUM' ? '🔧 MED' : null}
                            {quality === 'HIGH' ? '✨ HIGH' : null}
                            {quality === 'ULTRA' ? '💎 ULTRA' : null}
                        </button>
                    ))}
                </div>
                {config.graphicsQuality === 'CUSTOM' && <div className="text-[8px] text-purple-400 text-center mt-1 uppercase tracking-wider">Кастомна конфігурація</div>}
            </div>

            {/* Toggles */}
            <div className="space-y-3">
                <ToggleButton label="Шлейфи" description="Трасування траєкторій організмів" active={config.showTrails} onToggle={() => toggle('showTrails')} colorClass="bg-cyan-500" />
                <ToggleButton label="Частинки" description="Системи фонових мікро-ефектів" active={config.showParticles} onToggle={() => toggle('showParticles')} colorClass="bg-cyan-500" />
                <ToggleButton label="Світіння" description="Емісія енергетичних станів" active={config.showEnergyGlow} onToggle={() => toggle('showEnergyGlow')} colorClass="bg-cyan-500" />

                <div className="pt-4 border-t border-white/5">
                    <ToggleButton label="Авто-ротація" description="Кінематографічне обертання камери" active={autoRotate} onToggle={() => setAutoRotate(!autoRotate)} colorClass="bg-purple-500" />
                </div>

                {autoRotate && (
                    <SettingsSlider
                        label="Швидкість обертання"
                        param="autoRotateSpeed"
                        value={autoRotateSpeed}
                        min={0.1} max={10.0} step={0.1}
                        colorClass="accent-purple-500"
                        onChange={(_param, val) => setAutoRotateSpeed(val)}
                    />
                )}
            </div>
        </section>
    );
};
