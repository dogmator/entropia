import React, { useRef } from 'react';

import { logger } from '@/core';
import type { CheckpointStatus } from '@/core/persistence/CheckpointController.service';
import { t } from '@/i18n';

import type { CheckpointControls } from '../context/hooks/useCheckpoints';

const BUTTON_CLASS = 'px-3 py-2 rounded-lg bg-white/10 text-[11px] font-bold text-gray-200 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed';

const describeStatus = (status: CheckpointStatus): string => {
    switch (status.kind) {
        case 'starting': return t.checkpoints.starting;
        case 'unavailable': return `${t.checkpoints.unavailable}: ${status.reason}`;
        case 'readOnly': return status.reason;
        case 'idle': return t.checkpoints.idle;
        case 'saving': return t.checkpoints.saving;
        case 'saved': return `${t.checkpoints.saved} ${String(status.tick)}`;
        case 'recoveryAvailable': return `${t.checkpoints.recovery} ${String(status.tick)}`;
        case 'restored': return `${t.checkpoints.restored} ${String(status.tick)}`;
        case 'failed': return `${t.checkpoints.failed}: ${status.reason}`;
    }
};

const exportWorld = async (controls: CheckpointControls): Promise<void> => {
    try {
        const state = await controls.exportState();
        const url = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `entropia-tick-${String(state.tick)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        logger.error('World export failed', 'Checkpoints', { error });
    }
};

const importChosenFile = async (event: React.ChangeEvent<HTMLInputElement>, controls: CheckpointControls): Promise<void> => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again still raises a change event.
    event.target.value = '';
    if (!file) return;
    try {
        await controls.importText(await file.text());
    } catch (error) {
        logger.error('World file could not be read', 'Checkpoints', { error });
    }
};

export const CheckpointPanel: React.FC<{ controls: CheckpointControls }> = ({ controls }) => {
    const fileInput = useRef<HTMLInputElement>(null);
    const { status, canWrite } = controls;

    return (
        <section aria-label={t.checkpoints.title} className="flex flex-col gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t.checkpoints.title}</h3>
            <p role="status" className="text-[11px] text-gray-300">{describeStatus(status)}</p>
            {status.kind === 'restored' && status.skipped.length > 0 && (
                <p className="text-[11px] text-amber-300">{t.checkpoints.fallbackNote}</p>
            )}
            <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!canWrite} onClick={() => { void controls.save(); }} className={BUTTON_CLASS}>
                    {t.checkpoints.save}
                </button>
                <button type="button" onClick={() => { void exportWorld(controls); }} className={BUTTON_CLASS}>
                    {t.checkpoints.exportFile}
                </button>
                <button type="button" disabled={!canWrite} onClick={() => { fileInput.current?.click(); }} className={BUTTON_CLASS}>
                    {t.checkpoints.importFile}
                </button>
                <input
                    ref={fileInput}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(event) => { void importChosenFile(event, controls); }}
                />
            </div>
            {status.kind === 'recoveryAvailable' && (
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canWrite} onClick={() => { void controls.restore(); }} className={BUTTON_CLASS}>
                        {t.checkpoints.resume}
                    </button>
                    <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => { if (window.confirm(t.checkpoints.confirmDiscard)) void controls.discard(); }}
                        className={BUTTON_CLASS}
                    >
                        {t.checkpoints.discard}
                    </button>
                </div>
            )}
        </section>
    );
};
