import type React from 'react';

import { t } from '@/i18n';
import { useSimulation } from '../../context/SimulationContext';
import { SettingsSlider } from '../SettingsSlider';
import { useSettings } from './SettingsContext';
import { SectionHeader, ToggleButton } from './Shared';

export const PerformanceSettings = (): React.JSX.Element => {
    const { config, toggle, applyPreset } = useSettings();
    const { isAutoRotate, setAutoRotate, autoRotateSpeed, setAutoRotateSpeed } = useSimulation();

    return (
        <section>
            <SectionHeader title={t.settings.graphics} colorClass="text-cyan-400" borderColorClass="bg-cyan-500/20" />

            {/* Presets */}
            <div className="mb-6">
                <div className="text-[10px] sm:text-[9px] text-gray-400 uppercase tracking-widest mb-2 font-bold">{t.settings.graphicsProfile}</div>
                <div className="grid grid-cols-4 gap-2 mb-1">
                    {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((quality) => (
                        <button
                            key={quality}
                            onClick={() => { applyPreset(quality); }}
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
                {config.graphicsQuality === 'CUSTOM' && <div className="text-[8px] text-purple-400 text-center mt-1 uppercase tracking-wider">{t.settings.customConfig}</div>}
            </div>

            {/* Toggles */}
            <div className="space-y-3">
                <ToggleButton label={t.settings.trails} description={t.settings.trailSystem} active={config.showTrails} onToggle={() => { toggle('showTrails'); }} colorClass="bg-cyan-500" />
                <ToggleButton label={t.settings.particles} description={t.settings.microEffects} active={config.showParticles} onToggle={() => { toggle('showParticles'); }} colorClass="bg-cyan-500" />
                <ToggleButton label={t.settings.glow} description={t.settings.energyEmission} active={config.showEnergyGlow} onToggle={() => { toggle('showEnergyGlow'); }} colorClass="bg-cyan-500" />

                <div className="pt-4 border-t border-white/5">
                    <ToggleButton label={t.settings.autoRotate} description="Cinematic camera rotation" active={isAutoRotate} onToggle={() => { setAutoRotate(!isAutoRotate); }} colorClass="bg-purple-500" />
                </div>

                {isAutoRotate && (
                    <SettingsSlider
                        label={t.settings.rotationSpeed}
                        param="autoRotateSpeed"
                        value={autoRotateSpeed}
                        min={0.1} max={10.0} step={0.1}
                        colorClass="accent-purple-500"
                        onChange={(_param, val) => { setAutoRotateSpeed(val); }}
                    />
                )}
            </div>
        </section>
    );
};
