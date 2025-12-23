/**
 * Спеціалізований програмний інтерфейс (хук) для агрегації та обробки подій симуляційного двигуна.
 * 
 * Реалізує підписку на наступні класи подій:
 * - EntityDied - детермінація моменту завершення життєвого циклу суб'єкта та генерація візуального ефекту деструкції.
 * - EntityReproduced - реєстрація акту репродукції та ініціалізація візуальних ефектів виникнення нових агентів.
 */

import { useEffect, useRef } from 'react';
import { SimulationEngine } from '../../simulation/Engine';
import { ParticleSystem } from '../effects/ParticleSystem';
import { EntityType } from '../../types';
import { COLORS } from '../../constants';

export function useSimulationEvents(
  engine: SimulationEngine,
  particleSystem: ParticleSystem | null
) {
  const processedDeaths = useRef(new Set<string>());
  const processedBirths = useRef(new Set<string>());

  useEffect(() => {
    if (!particleSystem) return;

    const unsubscribe = engine.addEventListener((event) => {
      // Обробка подій летальності біологічних суб'єктів
      if (event.type === 'EntityDied') {
        if (
          event.entityType === EntityType.PREY ||
          event.entityType === EntityType.PREDATOR
        ) {
          const idStr = event.id as string;
          if (!processedDeaths.current.has(idStr)) {
            processedDeaths.current.add(idStr);

            const color =
              event.entityType === EntityType.PREY
                ? COLORS.prey.death
                : COLORS.predator.death;

            particleSystem.addDeathEffect(
              event.position,
              color,
              event.entityType === EntityType.PREDATOR
            );

            // Регулювання розміру реєстру оброблених подій для запобігання деградації пам'яті
            if (processedDeaths.current.size > 100) {
              const firstId = processedDeaths.current.values().next().value;
              if (firstId) processedDeaths.current.delete(firstId);
            }
          }
        }
      }
      // Обробка подій репродуктивного акту
      else if (event.type === 'EntityReproduced') {
        const childIdStr = event.childId as string;
        if (!processedBirths.current.has(childIdStr)) {
          processedBirths.current.add(childIdStr);

          const org = engine.organisms.get(event.parentId as string);
          const color = org?.isPrey ? COLORS.prey.glow : COLORS.predator.glow;

          particleSystem.addBirthEffect(event.position, color);

          // Обмеження обсягу реєстру для оптимізації використання оперативної пам'яті
          if (processedBirths.current.size > 100) {
            const firstId = processedBirths.current.values().next().value;
            if (firstId) processedBirths.current.delete(firstId);
          }
        }
      }
    });

    /**
     * Скасування підписки при розмонтуванні компонента для запобігання побічним ефектам.
     */
    return () => {
      unsubscribe();
    };
  }, [engine, particleSystem]);
}
