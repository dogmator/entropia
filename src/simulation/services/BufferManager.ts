/**
 * Entropia 3D — Менеджер буферів рендерингу.
 *
 * Відповідає за:
 * - Адаптивне управління ємністю Float32Array буферів.
 * - Серіалізацію даних організмів та їжі у буфери.
 * - Мінімізацію реалокацій через гістерезис.
 */

import type { RenderBuffers } from '@/types';

import type { Food, Organism } from '../Entity';

const BUFFER_CONSTANTS = {
    TRAIL_BUFFER_SIZE: 13,
    FOOD_BUFFER_SIZE: 5,
    GROWTH_FACTOR: 1.5,
    SHRINK_FACTOR: 1.25,
    MIN_CAPACITY: 100,
    MAX_INITIAL_CAPACITY: 10000, // Pre-allocate for SAB stability
    SHRINK_THRESHOLD: 0.25,
};

/**
 * Менеджер буферів рендерингу з адаптивним управлінням пам'яттю.
 */
export class BufferManager {
    private _preyBuffer: Float32Array = new Float32Array(0);
    private _predBuffer: Float32Array = new Float32Array(0);
    private _foodBuffer: Float32Array = new Float32Array(0);

    private static readonly PREY_STRIDE = BUFFER_CONSTANTS.TRAIL_BUFFER_SIZE;
    private static readonly PRED_STRIDE = BUFFER_CONSTANTS.TRAIL_BUFFER_SIZE;
    private static readonly FOOD_STRIDE = BUFFER_CONSTANTS.FOOD_BUFFER_SIZE;

    private _useSharedArrayBuffer = false;
    private _sharedBuffer: SharedArrayBuffer | null = null;

    constructor(useSharedArrayBuffer = false) {
        this._useSharedArrayBuffer = useSharedArrayBuffer;
    }

    /**
     * Отримання даних рендерингу з усіх буферів.
     */
    public getRenderData(
        organisms: Map<string, Organism>,
        deadOrganisms: Map<string, Organism>,
        food: Map<string, Food>
    ): RenderBuffers {
        const counts = this.countEntities(organisms, deadOrganisms, food);
        this.updateBufferCapacities(counts);
        this.fillRenderBuffers(organisms, deadOrganisms, food);

        return {
            prey: this._preyBuffer,
            preyCount: counts.prey,
            predators: this._predBuffer,
            predatorCount: counts.pred,
            food: this._foodBuffer,
            foodCount: counts.food,
            sharedBuffer: this._sharedBuffer ?? undefined,
        };
    }

    /**
     * Скидання буферів.
     */
    public reset(): void {
        this._preyBuffer = new Float32Array(0);
        this._predBuffer = new Float32Array(0);
        this._foodBuffer = new Float32Array(0);
    }

    // ============================================================================
    // ПРИВАТНІ МЕТОДИ
    // ============================================================================

    private countEntities(
        organisms: Map<string, Organism>,
        deadOrganisms: Map<string, Organism>,
        food: Map<string, Food>
    ): { prey: number; pred: number; food: number } {
        let prey = 0;
        let pred = 0;

        // Живі організми
        organisms.forEach(o => {
            if (!o.isDead) {
                if (o.isPrey) { prey++; } else { pred++; }
            }
        });

        // Мертві організми
        if (deadOrganisms) {
            deadOrganisms.forEach(o => {
                if (o.isPrey) { prey++; } else { pred++; }
            });
        }

        let foodCount = 0;
        food.forEach(f => {
            if (!f.consumed) { foodCount++; }
        });

        // Diagnostic counts for buffer management logic
        return { prey, pred, food: foodCount };
    }

    private updateBufferCapacities(counts: { prey: number; pred: number; food: number }): void {
        this._preyBuffer = this.ensureBufferCapacityAdaptive(
            this._preyBuffer,
            counts.prey * BufferManager.PREY_STRIDE
        );
        this._predBuffer = this.ensureBufferCapacityAdaptive(
            this._predBuffer,
            counts.pred * BufferManager.PRED_STRIDE
        );
        this._foodBuffer = this.ensureBufferCapacityAdaptive(
            this._foodBuffer,
            counts.food * BufferManager.FOOD_STRIDE
        );
    }

    private fillRenderBuffers(
        organisms: Map<string, Organism>,
        deadOrganisms: Map<string, Organism>,
        food: Map<string, Food>
    ): void {
        let preyOffset = 0;
        let predOffset = 0;

        const writeOrganism = (o: Organism, isDead: boolean) => {
            const isPrey = o.isPrey;
            const buffer = isPrey ? this._preyBuffer : this._predBuffer;
            const offset = isPrey ? preyOffset : predOffset;

            this.writeOrganismToBuffer(o, buffer, offset, isDead);

            if (isPrey) {
                preyOffset += BufferManager.PREY_STRIDE;
            } else {
                predOffset += BufferManager.PRED_STRIDE;
            }
        };

        // Записуємо живих
        organisms.forEach(o => {
            if (o.isDead) { return; } // Живі не повинні бути мертвими (хоча Engine це гарантує)
            writeOrganism(o, false);
        });

        // Записуємо мертвих
        if (deadOrganisms) {
            deadOrganisms.forEach(o => {
                writeOrganism(o, true);
            });
        }

        let foodOffset = 0;
        food.forEach(f => {
            if (f.consumed) { return; }
            this.writeFoodToBuffer(f, this._foodBuffer, foodOffset);
            foodOffset += BufferManager.FOOD_STRIDE;
        });
    }

    /* eslint-disable @typescript-eslint/no-magic-numbers */
    private writeOrganismToBuffer(o: Organism, buffer: Float32Array, offset: number, isDead: boolean): void {
        buffer[offset + 0] = o.position.x;
        buffer[offset + 1] = o.position.y;
        buffer[offset + 2] = o.position.z;
        buffer[offset + 3] = o.velocity.x;
        buffer[offset + 4] = o.velocity.y;
        buffer[offset + 5] = o.velocity.z;
        buffer[offset + 6] = o.radius;
        buffer[offset + 7] = isDead ? 1.0 : 0.0; // Прапор смерті
        buffer[offset + 8] = parseInt(o.id.split('_')[1] || '0', 10);
        buffer[offset + 9] = 0;
        buffer[offset + 10] = 0;
        buffer[offset + 11] = 0;
        buffer[offset + 12] = 0;
    }

    private writeFoodToBuffer(f: Food, buffer: Float32Array, offset: number): void {
        buffer[offset + 0] = f.position.x;
        buffer[offset + 1] = f.position.y;
        buffer[offset + 2] = f.position.z;
        buffer[offset + 3] = f.radius;
        buffer[offset + 4] = parseInt(f.id.split('_')[1] || '0', 10);
    }
    /* eslint-enable @typescript-eslint/no-magic-numbers */

    /**
     * Адаптивне управління ємністю буфера з підтримкою динамічного скорочення.
     */
    private ensureBufferCapacityAdaptive(
        buffer: Float32Array,
        requiredSize: number
    ): Float32Array {
        const currentCapacity = buffer.length;

        // Розширення: якщо буфер занадто малий
        if (requiredSize > currentCapacity) {
            const newCapacity = Math.max(
                Math.ceil(requiredSize * BUFFER_CONSTANTS.GROWTH_FACTOR),
                BUFFER_CONSTANTS.MIN_CAPACITY
            );

            if (this._useSharedArrayBuffer && typeof SharedArrayBuffer !== 'undefined') {
                // For SAB, we allocate a single large buffer or re-create it.
                // Re-creating SAB requires a new handshake, but simpler for MVP.
                const byteSize = newCapacity * Float32Array.BYTES_PER_ELEMENT;
                this._sharedBuffer = new SharedArrayBuffer(byteSize);
                return new Float32Array(this._sharedBuffer);
            }

            return new Float32Array(newCapacity);
        }

        // Скорочення: адаптивне зменшення ємності при значному спаді популяції
        const shrinkThreshold = currentCapacity * BUFFER_CONSTANTS.SHRINK_THRESHOLD;

        if (requiredSize < shrinkThreshold && currentCapacity > BUFFER_CONSTANTS.MIN_CAPACITY) {
            const newCapacity = Math.max(
                Math.ceil(requiredSize * BUFFER_CONSTANTS.SHRINK_FACTOR),
                BUFFER_CONSTANTS.MIN_CAPACITY
            );

            if (this._useSharedArrayBuffer && typeof SharedArrayBuffer !== 'undefined') {
                const byteSize = newCapacity * Float32Array.BYTES_PER_ELEMENT;
                this._sharedBuffer = new SharedArrayBuffer(byteSize);
                return new Float32Array(this._sharedBuffer);
            }

            return new Float32Array(newCapacity);
        }

        return buffer;
    }
}
