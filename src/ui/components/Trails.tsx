import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { BUFFER_LAYOUT, COLORS, RENDER } from '../../config';
import type { ISimulationEngine } from '../../simulation/interfaces/ISimulationEngine';
import { TrailSystem } from '../effects/ParticleSystem';

interface TrailParams {
    position: { x: number; y: number; z: number };
    color: number;
    isEnabled: boolean;
}

interface TrailsProps {
    engine: ISimulationEngine;
}

interface UpdateEntityTrailsParams {
    data: Float32Array;
    count: number;
    prefix: string;
    idCache: Map<number, string>;
    params: TrailParams;
    trailSystem: TrailSystem;
}

const updateEntityTrails = (options: UpdateEntityTrailsParams): void => {
    const { data, count, prefix, idCache, params, trailSystem } = options;
    for (let i = 0; i < count; i++) {
        const offset = i * BUFFER_LAYOUT.STRIDE;
        const numId = data[offset + BUFFER_LAYOUT.OFFSETS.ID] ?? 0;
        let id = idCache.get(numId);
        if (!id) {
            id = `${prefix}${String(numId)}`;
            idCache.set(numId, id);
        }
        params.position.x = data[offset + BUFFER_LAYOUT.OFFSETS.X] ?? 0;
        params.position.y = data[offset + BUFFER_LAYOUT.OFFSETS.Y] ?? 0;
        params.position.z = data[offset + BUFFER_LAYOUT.OFFSETS.Z] ?? 0;
        trailSystem.updateTrail(id, params);
    }
};

export const Trails: React.FC<TrailsProps> = ({ engine }) => {
    const { scene } = useThree();
    const preyIdCacheRef = useRef<Map<number, string>>(new Map());
    const predatorIdCacheRef = useRef<Map<number, string>>(new Map());
    const trailParamsRef = useRef({
        prey: {
            position: { x: 0, y: 0, z: 0 },
            color: COLORS.prey.trail,
            isEnabled: true
        },
        predator: {
            position: { x: 0, y: 0, z: 0 },
            color: COLORS.predator.trail,
            isEnabled: true
        }
    });

    const trailSystem = useMemo(() => {
        return new TrailSystem(scene, RENDER.maxTrailParticles);
    }, [scene]);

    useEffect(() => {
        return () => {
            trailSystem.dispose();
        };
    }, [trailSystem]);

    useFrame(() => {
        if (!engine.config.showTrails) {
            trailSystem.clear(); // Ensure trails are gone if disabled
            return;
        }

        trailSystem.beginFrame();

        const renderBuffers = engine.getRenderData();
        const { prey, predators, preyCount, predatorCount } = renderBuffers;

        updateEntityTrails({ data: prey, count: preyCount, prefix: 'prey_', idCache: preyIdCacheRef.current, params: trailParamsRef.current.prey, trailSystem });
        updateEntityTrails({ data: predators, count: predatorCount, prefix: 'predator_', idCache: predatorIdCacheRef.current, params: trailParamsRef.current.predator, trailSystem });

        trailSystem.prune();
    });

    return null;
};
