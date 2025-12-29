import { SettingsSlider } from '../SettingsSlider';
import { useSettings } from './SettingsContext';
import { SectionHeader } from './Shared';

export const AdvancedSettings = () => {
    const { config, update } = useSettings();

    return (
        <div className="space-y-9">
            {/* Instincts */}
            <section>
                <SectionHeader title="Інстинкти" colorClass="text-blue-400" borderColorClass="bg-blue-500/20" />
                <SettingsSlider label="Сепарація" param="separationWeight" value={config.separationWeight} min={0} max={10} step={0.1} colorClass="accent-blue-500" onChange={update} />
                <SettingsSlider label="Інтенсивність пошуку" param="seekWeight" value={config.seekWeight} min={0} max={10} step={0.1} colorClass="accent-blue-500" onChange={update} />
                <SettingsSlider label="Уникнення колізій" param="avoidWeight" value={config.avoidWeight} min={0} max={20} step={0.1} colorClass="accent-blue-500" onChange={update} />
            </section>

            {/* Visualization */}
            <section>
                <SectionHeader title="Візуалізація" colorClass="text-amber-400" borderColorClass="bg-amber-500/20" />
                <SettingsSlider label="Прозорість тіл" param="organismOpacity" value={config.organismOpacity} min={0.1} max={1.0} step={0.05} colorClass="accent-amber-500" onChange={update} />
                <SettingsSlider label="Масштаб тіл" param="organismScale" value={config.organismScale} min={0.5} max={3.0} step={0.1} colorClass="accent-amber-500" onChange={update} />
                <SettingsSlider label="Прозорість ресурсів" param="foodOpacity" value={config.foodOpacity} min={0.1} max={1.0} step={0.05} colorClass="accent-amber-500" onChange={update} />
                <SettingsSlider label="Масштаб ресурсів" param="foodScale" value={config.foodScale} min={0.5} max={3.0} step={0.1} colorClass="accent-amber-500" onChange={update} />
                <SettingsSlider label="Координатна сітка" param="gridOpacity" value={config.gridOpacity} min={0.0} max={0.5} step={0.01} colorClass="accent-amber-500" onChange={update} />
            </section>
        </div>
    );
};
