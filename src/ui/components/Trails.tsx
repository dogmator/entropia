import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useMemo } from 'react';

import { BUFFER_LAYOUT, COLORS, RENDER } from '../../config';
import type { ISimulationEngine } from '../../simulation/interfaces/ISimulationEngine';
import { TrailSystem } from '../effects/ParticleSystem';

interface TrailsProps {
    engine: ISimulationEngine;
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
        if (!engine.config.showTrails) {
            trailSystem.clear(); // Ensure trails are gone if disabled
            return;
        }

        trailSystem.beginFrame();

        const renderBuffers = engine.getRenderData();
        const { prey, predators, preyCount, predatorCount } = renderBuffers;

        // Update Prey Trails
        for (let i = 0; i < preyCount; i++) {
            const offset = i * BUFFER_LAYOUT.STRIDE;
            const numId = prey[offset + BUFFER_LAYOUT.OFFSETS.ID] || 0;
            const id = `prey_${numId}`;

            const x = prey[offset + BUFFER_LAYOUT.OFFSETS.X] || 0;
            const y = prey[offset + BUFFER_LAYOUT.OFFSETS.Y] || 0;
            const z = prey[offset + BUFFER_LAYOUT.OFFSETS.Z] || 0;

            trailSystem.updateTrail(id, {
                position: { x, y, z },
                color: COLORS.prey.trail || 0x00ff00,
                enabled: true
            });
        }

        // Update Predator Trails
        for (let i = 0; i < predatorCount; i++) {
            const offset = i * BUFFER_LAYOUT.STRIDE;
            const numId = predators[offset + BUFFER_LAYOUT.OFFSETS.ID] || 0;
            const id = `predator_${numId}`;

            const x = predators[offset + BUFFER_LAYOUT.OFFSETS.X] || 0;
            const y = predators[offset + BUFFER_LAYOUT.OFFSETS.Y] || 0;
            const z = predators[offset + BUFFER_LAYOUT.OFFSETS.Z] || 0;

            trailSystem.updateTrail(id, {
                position: { x, y, z },
                color: COLORS.predator.trail || 0xff0000,
                enabled: true
            });
        }

        trailSystem.prune();
    });

    return null;
};
