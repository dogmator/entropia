import { SettingsSlider } from '../SettingsSlider';
import { useSettings } from './SettingsContext';
import { SectionHeader, ToggleButton } from './Shared';

export const GeneralSettings = () => {
    const { config, update, toggle, worldScale, onWorldScaleChange } = useSettings();

    return (
        <div className="space-y-9">
            {/* Cosmology */}
            <section>
                <SectionHeader title="Космологія" colorClass="text-purple-400" borderColorClass="bg-purple-500/20" />
                <div className="group flex flex-col gap-1.5 mb-4 last:mb-0">
                    <div className="flex justify-between items-center text-[11px] sm:text-[10px] uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">
                        <span className="font-bold">Масштаб Світу</span>
                        <span className="font-mono font-black text-white bg-white/5 px-2 py-0.5 rounded text-[10px] sm:text-[9px] min-w-[36px] text-center">
                            {worldScale.toFixed(1)}x
                        </span>
                    </div>
                    <input
                        type="range" min={0.5} max={5.0} step={0.1} value={worldScale}
                        onChange={(e) => onWorldScaleChange(parseFloat(e.target.value))}
                        className="w-full h-2 sm:h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:bg-white/20 transition-all touch-manipulation"
                    />
                </div>
            </section>

            {/* Biosphere */}
            <section>
                <SectionHeader title="Біосфера" />
                <SettingsSlider label="Генерація їжі" param="foodSpawnRate" value={config.foodSpawnRate} min={0} max={1} step={0.05} onChange={update} />
                <SettingsSlider label="Ліміт ресурсів" param="maxFood" value={config.maxFood} min={50} max={2000} step={50} onChange={update} />
                <SettingsSlider label="Популяційний ліміт" param="maxOrganisms" value={config.maxOrganisms} min={10} max={1000} step={10} onChange={update} />
                <ToggleButton label="Аномалії середовища" active={config.showObstacles} onToggle={() => toggle('showObstacles')} />
                <SettingsSlider label="Опір середовища" param="drag" value={config.drag} min={0.8} max={1.0} step={0.005} onChange={update} />
                <SettingsSlider label="Темп мутації" param="mutationFactor" value={config.mutationFactor} min={0.01} max={0.5} step={0.01} onChange={update} />
                <SettingsSlider label="Репродуктивний поріг" param="reproductionThreshold" value={config.reproductionThreshold} min={100} max={500} step={10} onChange={update} />
            </section>
        </div>
    );
};
