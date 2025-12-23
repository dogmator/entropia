/**
 * Спеціалізований програмний інтерфейс (хук) для управління системами мікрочастотних візуальних ефектів.
 * 
 * Забезпечує ініціалізацію та життєвий цикл наступних динамічних структур:
 * - CosmicBackground - фонова репрезентація космічного простору
 * - ParticleSystem - генеративна система часток для візуалізації подій
 * - TrailSystem - система трасування індивідуальних траєкторій біологічних суб'єктів (слідів)
 */

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { CosmicBackground } from '../effects/CosmicBackground';
import { ParticleSystem, TrailSystem } from '../effects/ParticleSystem';

export interface ParticleEffects {
  cosmicBackground: CosmicBackground;
  particleSystem: ParticleSystem;
  trailSystem: TrailSystem;
}

export function useParticleEffects(scene: THREE.Scene | null) {
  const [effectsData, setEffectsData] = useState<ParticleEffects | null>(null);

  useEffect(() => {
    if (!scene) return;

    // Ініціалізація компонентів систем візуальних ефектів
    const cosmicBackground = new CosmicBackground(scene);
    const particleSystem = new ParticleSystem(scene);
    const trailSystem = new TrailSystem(scene);

    setEffectsData({
      cosmicBackground,
      particleSystem,
      trailSystem,
    });

    /**
     * Термінальна функція деструкції об'єктів для вивільнення ресурсів графічного процесора.
     */
    return () => {
      cosmicBackground.dispose();
      particleSystem.dispose();
      trailSystem.dispose();
    };
  }, [scene]);

  return effectsData;
}
