import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useMemo } from 'react';

import { COLORS, RENDER } from '../../config';
import type { SimulationEngine } from '../../simulation/Engine';
import { TrailSystem } from '../effects/ParticleSystem';

interface TrailsProps {
    engine: SimulationEngine;
}

export const Trails: React.FC<TrailsProps> = ({ engine }) => {
    const { scene } = useThree();

    const trailSystem = useMemo(() => {
        return new TrailSystem(scene, RENDER.maxTrailParticles);
    }, [scene]);

    useEffect(() => {
        return () => {
            trailSystem.dispose();
        };
    }, [trailSystem]);

    useFrame(() => {
        const renderBuffers = engine.getRenderData();
        const { prey, predators, preyCount, predatorCount } = renderBuffers;

        // Update Prey Trails
        for (let i = 0; i < preyCount; i++) {
            const offset = i * 13;
            // id is at offset + 8? Need to verify buffer layout in Engine.ts
            // Engine.ts: buffer[offset + 8] = numId;
            // But TrailSystem expects string ID.
            // We need to reconstruct ID or use numId if unique.
            // Engine.ts: id = `type_${numId}` (e.g. prey_1)
            const numId = prey[offset + 8] || 0;
            const id = `prey_${numId}`;

            const x = prey[offset + 0] || 0;
            const y = prey[offset + 1] || 0;
            const z = prey[offset + 2] || 0;

            trailSystem.updateTrail(id, {
                position: { x, y, z },
                color: COLORS.prey.trail || 0x00ff00,
                enabled: true
            });
        }

        // Update Predator Trails
        for (let i = 0; i < predatorCount; i++) {
            const offset = i * 13;
            const numId = predators[offset + 8] || 0;
            const id = `predator_${numId}`;

            const x = predators[offset + 0] || 0;
            const y = predators[offset + 1] || 0;
            const z = predators[offset + 2] || 0;

            trailSystem.updateTrail(id, {
                position: { x, y, z },
                color: COLORS.predator.trail || 0xff0000,
                enabled: true
            });
        }
    });

    return null;
};
