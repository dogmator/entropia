/* eslint-disable @typescript-eslint/no-magic-numbers, max-lines-per-function -- explicit sample values make race conditions readable */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IEntityInfo } from '@/shared/interfaces/IEntityInfo';

import { type HoverTarget,LiveHoverSession } from '../LiveHoverSession';

const TARGET: HoverTarget = { role: 'prey', kind: 'prey', numericId: 17, isDead: false };
const OTHER: HoverTarget = { role: 'prey', kind: 'prey', numericId: 23, isDead: false };
const entity = (id: number, age: number): IEntityInfo => ({
    id: `org_${String(id)}`, type: 'prey', position: { x: 0, y: 0, z: 0 },
    radius: age
} as unknown as IEntityInfo);

describe('LiveHoverSession', () => {
    const received = vi.fn();
    const errors = vi.fn();
    const requests: {
        kind: string;
        id: number;
        finish: (entity: IEntityInfo | null) => void;
    }[] = [];
    let session: LiveHoverSession;

    beforeEach(() => {
        requests.length = 0;
        received.mockClear();
        errors.mockClear();
        session = new LiveHoverSession(
            (kind, id) => new Promise(resolve => {
                requests.push({ kind, id, finish: resolve });
            }),
            received,
            errors
        );
    });

    it('refreshes the same entity even when the pointer has not moved', async () => {
        session.move(TARGET);
        expect(requests).toHaveLength(1);
        expect(requests[0]?.id).toBe(TARGET.numericId);
        requests[0]?.finish(entity(17, 100));
        await vi.waitFor(() => { expect(received).toHaveBeenLastCalledWith(entity(17, 100)); });

        // A repeated pointer event does not generate an extra request; the refresh does.
        session.move(TARGET);
        expect(requests).toHaveLength(1);
        session.refresh();
        expect(requests).toHaveLength(2);
        requests[1]?.finish(entity(17, 120));
        await vi.waitFor(() => { expect(received).toHaveBeenLastCalledWith(entity(17, 120)); });
    });

    it('ignores a late response after pointer-out', async () => {
        session.move(TARGET);
        session.leave(TARGET);
        requests[0]?.finish(entity(17, 100));
        await Promise.resolve();
        expect(received).toHaveBeenLastCalledWith(null);
        expect(received).not.toHaveBeenCalledWith(entity(17, 100));
    });

    it('never replaces a newer entity with a delayed response for an older one', async () => {
        session.move(TARGET);
        session.move(OTHER);
        requests[1]?.finish(entity(23, 500));
        await vi.waitFor(() => { expect(received).toHaveBeenLastCalledWith(entity(23, 500)); });
        requests[0]?.finish(entity(17, 50));
        await Promise.resolve();
        expect(received).toHaveBeenLastCalledWith(entity(23, 500));
        session.leave(TARGET);
        expect(received).toHaveBeenLastCalledWith(entity(23, 500));
    });

    it('removes the tooltip when the entity is no longer present', async () => {
        session.move(TARGET);
        requests[0]?.finish(entity(17, 60));
        await vi.waitFor(() => { expect(received).toHaveBeenLastCalledWith(entity(17, 60)); });
        session.refresh();
        requests[1]?.finish(null);
        await vi.waitFor(() => { expect(received).toHaveBeenLastCalledWith(null); });
        session.refresh();
        expect(requests).toHaveLength(2);
    });

    it('does not overlap requests and clears on world reset', async () => {
        session.move(TARGET);
        session.refresh();
        session.refresh();
        expect(requests).toHaveLength(1);
        session.clear();
        requests[0]?.finish(entity(17, 50));
        await Promise.resolve();
        expect(received).toHaveBeenLastCalledWith(null);
    });
});
