import type { IEntityInfo } from '@/shared/interfaces/IEntityInfo';
import type { RenderedKind } from '@/shared/interfaces/RenderedKind';

export interface HoverTarget {
    role: string;
    kind: RenderedKind;
    numericId: number;
    isDead: boolean;
}

export type ResolveHoveredEntity = (kind: RenderedKind, numericId: number, isDead: boolean) => Promise<IEntityInfo | null>;

/**
 * Keeps a hovered mesh instance tied to its entity ID, not to a snapshot-dependent instance index.
 * Only one query may be outstanding. Responses from targets that were left or replaced are discarded.
 */
export class LiveHoverSession {
    private target: HoverTarget | null = null;
    private requestVersion = 0;
    private isPending = false;

    constructor(
        private readonly resolve: ResolveHoveredEntity,
        private readonly onChange: (entity: IEntityInfo | null) => void,
        private readonly onError: (error: unknown) => void,
    ) {}

    public move(target: HoverTarget): void {
        const previous = this.target;
        if (previous?.kind === target.kind && previous.numericId === target.numericId
            && previous.isDead === target.isDead && previous.role === target.role) return;

        this.requestVersion++;
        this.target = target;
        this.isPending = false;
        this.onChange(null);
        this.refresh();
    }

    public refresh(): void {
        if (!this.target || this.isPending) return;
        const { kind, numericId, isDead } = this.target;
        const version = this.requestVersion;
        this.isPending = true;

        void this.resolve(kind, numericId, isDead)
            .then(entity => {
                if (version !== this.requestVersion) return;
                if (!entity) {
                    this.clear();
                    return;
                }
                this.onChange(entity);
            })
            .catch((error: unknown) => {
                if (version === this.requestVersion) this.onError(error);
            })
            .finally(() => {
                if (version === this.requestVersion) this.isPending = false;
            });
    }

    public leave(target: HoverTarget): void {
        if (this.target?.role === target.role && this.target.numericId === target.numericId) this.clear();
    }

    public clear(): void {
        this.requestVersion++;
        this.target = null;
        this.isPending = false;
        this.onChange(null);
    }

    public dispose(): void {
        this.clear();
    }
}
