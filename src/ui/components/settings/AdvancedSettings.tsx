import type React from 'react';

import { t } from '@/i18n';
import { SettingsSlider } from '../SettingsSlider';
import { useSettings } from './SettingsContext';
import { SectionHeader } from './Shared';

export const AdvancedSettings = (): React.JSX.Element => {
    const { config, update } = useSettings();

    return (
        <div className="space-y-9">
            {/* Instincts */}
            <section>
                <SectionHeader title={t.settings.instincts} colorClass="text-blue-400" borderColorClass="bg-blue-500/20" />
                <SettingsSlider label={t.settings.separation} param="separationWeight" value={config.separationWeight} min={0} max={10} step={0.1} colorClass="accent-blue-500" onChange={update} />
                <SettingsSlider label={t.settings.seekWeight} param="seekWeight" value={config.seekWeight} min={0} max={10} step={0.1} colorClass="accent-blue-500" onChange={update} />
                <SettingsSlider label={t.settings.collision} param="avoidWeight" value={config.avoidWeight} min={0} max={20} step={0.1} colorClass="accent-blue-500" onChange={update} />
            </section>

            {/* Visualization */}
            <section>
                <SectionHeader title={t.settings.visuals} colorClass="text-amber-400" borderColorClass="bg-amber-500/20" />
                <SettingsSlider label={t.settings.bodyOpacity} param="organismOpacity" value={config.organismOpacity} min={0.1} max={1.0} step={0.05} colorClass="accent-amber-500" onChange={update} />
                <SettingsSlider label={t.settings.bodyScale} param="organismScale" value={config.organismScale} min={0.5} max={3.0} step={0.1} colorClass="accent-amber-500" onChange={update} />
                <SettingsSlider label={t.settings.resourceOpacity} param="foodOpacity" value={config.foodOpacity} min={0.1} max={1.0} step={0.05} colorClass="accent-amber-500" onChange={update} />
                <SettingsSlider label={t.settings.resourceScale} param="foodScale" value={config.foodScale} min={0.5} max={3.0} step={0.1} colorClass="accent-amber-500" onChange={update} />
                <SettingsSlider label={t.settings.grid} param="gridOpacity" value={config.gridOpacity} min={0.0} max={0.5} step={0.01} colorClass="accent-amber-500" onChange={update} />
            </section>
        </div>
    );
};
