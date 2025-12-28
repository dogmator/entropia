import { useFrame } from '@react-three/fiber';
import React from 'react';

import { useSimulation } from '../context/SimulationContext';

/**
 * Components responsible for driving the simulation loop from the requestAnimationFrame (via R3F useFrame).
 * This ensures that the simulation advances in sync with the renderer when running on the main thread.
 */
export const SimulationDriver: React.FC = () => {
    const { engine, speed } = useSimulation();

    useFrame(() => {
        if (speed <= 0) { return; }

        // Execute update as many times as speed multiplier indicates
        // For fractional speeds, we might want to accumulate delta, but for now simple floor is robust enough
        const iterations = Math.floor(speed);
        for (let i = 0; i < iterations; i++) {
            engine.update();
        }
    });

    return null;
};
