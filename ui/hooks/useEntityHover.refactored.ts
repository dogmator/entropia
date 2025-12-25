/**
 * Програмний інтерфейс (хук) для детермінації стану наведення курсора на об'єкти віртуального середовища.
 *
 * ОПТИМІЗАЦІЇ (версія 2.0):
 * ✓ Видалення всіх діагностичних викликів Logger.debug() з render loop
 * ✓ Використання конфігураційних констант замість магічних чисел
 * ✓ Правильні залежності у useCallback для запобігання stale closures
 * ✓ Оптимізація алгоритму пріоритизації перетинів
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { SimulationEngine } from '../../simulation/Engine';
import { Organism, Food, Obstacle } from '../../simulation/Entity';
import { EntityType } from '../../types';
import { RAYCASTER_CONFIG, TOOLTIP_CONFIG } from '../config/RenderConfig';

export interface EntityHoverHook {
  hoveredEntity: Organism | Food | Obstacle | null;
  tooltipVisible: boolean;
  tooltipPos: { x: number; y: number };
  onMouseMove: (event: MouseEvent) => void;
  onClick: (
    camera: THREE.PerspectiveCamera,
    preyMesh: THREE.InstancedMesh,
    predMesh: THREE.InstancedMesh,
    foodMesh: THREE.InstancedMesh,
    idMaps: {
      prey: Map<number, string>;
      pred: Map<number, string>;
      food: Map<number, string>;
    },
    engine: SimulationEngine
  ) => void;
  updateHoveredEntity: (
    camera: THREE.PerspectiveCamera,
    preyMesh: THREE.InstancedMesh,
    predMesh: THREE.InstancedMesh,
    foodMesh: THREE.InstancedMesh,
    obstacleMeshes: THREE.Mesh[],
    idMaps: {
      prey: Map<number, string>;
      pred: Map<number, string>;
      food: Map<number, string>;
    },
    engine: SimulationEngine
  ) => void;
}

export function useEntityHover(): EntityHoverHook {
  // ========================================================================
  // СТІЙКІ ПОСИЛАННЯ ДЛЯ УНИКНЕННЯ РЕКРЕАЦІЇ ОБ'ЄКТІВ
  // ========================================================================

  const mouse = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const fadeTimeoutRef = useRef<number | null>(null);

  // ========================================================================
  // СТАН КОМПОНЕНТА
  // ========================================================================

  const [hoveredEntity, setHoveredEntity] = useState<
    Organism | Food | Obstacle | null
  >(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ========================================================================
  // КОНФІГУРАЦІЯ RAYCASTER
  // ========================================================================

  useEffect(() => {
    raycaster.current.params.Points = {
      threshold: RAYCASTER_CONFIG.pointsThreshold,
    };
    raycaster.current.params.Line = {
      threshold: RAYCASTER_CONFIG.lineThreshold,
    };
  }, []);

  // ========================================================================
  // УПРАВЛІННЯ ВІЗУАЛЬНОЮ ТРАНЗИТИВНІСТЮ TOOLTIP
  // ========================================================================

  useEffect(() => {
    if (hoveredEntity) {
      setTooltipVisible(true);
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    } else {
      fadeTimeoutRef.current = window.setTimeout(() => {
        setTooltipVisible(false);
      }, TOOLTIP_CONFIG.fadeOutDelay);
    }

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [hoveredEntity]);

  // ========================================================================
  // ОБРОБНИК ПОДІЇ ПЕРЕМІЩЕННЯ МАНІПУЛЯТОРА
  // ========================================================================

  const onMouseMove = useCallback((event: MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    mouse.current.x = (x / rect.width) * 2 - 1;
    mouse.current.y = -(y / rect.height) * 2 + 1;

    setTooltipPos({ x: event.clientX, y: event.clientY });
  }, []);

  // ========================================================================
  // ОБРОБНИК ПОДІЇ ВЗАЄМОДІЇ (КЛІК)
  // ========================================================================

  const onClick = useCallback(
    (
      camera: THREE.PerspectiveCamera,
      preyMesh: THREE.InstancedMesh,
      predMesh: THREE.InstancedMesh,
      foodMesh: THREE.InstancedMesh,
      idMaps: {
        prey: Map<number, string>;
        pred: Map<number, string>;
        food: Map<number, string>;
      },
      engine: SimulationEngine
    ) => {
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects([
        preyMesh,
        predMesh,
        foodMesh,
      ]);

      if (intersects.length === 0) return;

      const hit = intersects[0];
      let id: string | undefined;

      if (hit.object === preyMesh && hit.instanceId !== undefined) {
        id = idMaps.prey.get(hit.instanceId);
      } else if (hit.object === predMesh && hit.instanceId !== undefined) {
        id = idMaps.pred.get(hit.instanceId);
      } else if (hit.object === foodMesh && hit.instanceId !== undefined) {
        id = idMaps.food.get(hit.instanceId);
      }

      if (id) {
        const org = engine.organisms.get(id);
        if (org) {
          // Перемикання стану візуалізації траєкторії руху
          org.trailEnabled = !org.trailEnabled;
        }
      }
    },
    [] // Коректні залежності: функція не використовує зовнішній стан
  );

  // ========================================================================
  // МЕХАНІЗМ ІТЕРАТИВНОГО ОНОВЛЕННЯ СТАНУ НАВЕДЕНОГО ОБ'ЄКТА
  // ========================================================================

  const updateHoveredEntity = useCallback(
    (
      camera: THREE.PerspectiveCamera,
      preyMesh: THREE.InstancedMesh,
      predMesh: THREE.InstancedMesh,
      foodMesh: THREE.InstancedMesh,
      obstacleMeshes: THREE.Mesh[],
      idMaps: {
        prey: Map<number, string>;
        pred: Map<number, string>;
        food: Map<number, string>;
      },
      engine: SimulationEngine
    ) => {
      raycaster.current.setFromCamera(mouse.current, camera);

      const objectsToRaycast: THREE.Object3D[] = [
        preyMesh,
        predMesh,
        foodMesh,
        ...obstacleMeshes,
      ];

      const intersects = raycaster.current.intersectObjects(objectsToRaycast);

      if (intersects.length === 0) {
        setHoveredEntity(null);
        return;
      }

      // ====================================================================
      // ОПТИМІЗОВАНА ПРІОРИТИЗАЦІЯ ПЕРЕТИНІВ
      // ====================================================================

      // Пріоритет: їжа > організми > перешкоди
      // Знаходимо найближчу їжу, якщо є
      let foodHit = intersects.find(
        (h) =>
          h.object === foodMesh || h.object.userData.type === EntityType.FOOD
      );

      // Якщо їжа близько (в межах 5 одиниць від найближчого об'єкта), віддаємо їй пріоритет
      let hit = intersects[0];
      if (foodHit && foodHit.distance < hit.distance + 5) {
        hit = foodHit;
      }

      // ====================================================================
      // ДЕТЕРМІНАЦІЯ ТИПУ ТА ЕКСТРАКЦІЯ СУТНОСТІ
      // ====================================================================

      let entity: Organism | Food | Obstacle | null = null;

      if (hit.object === preyMesh && hit.instanceId !== undefined) {
        const id = idMaps.prey.get(hit.instanceId);
        if (id) entity = engine.organisms.get(id) ?? null;
      } else if (hit.object === predMesh && hit.instanceId !== undefined) {
        const id = idMaps.pred.get(hit.instanceId);
        if (id) entity = engine.organisms.get(id) ?? null;
      } else if (
        hit.object === foodMesh ||
        hit.object.userData.type === EntityType.FOOD
      ) {
        if (hit.instanceId !== undefined) {
          const foodId = idMaps.food.get(hit.instanceId);
          if (foodId) {
            entity = engine.food.get(foodId) ?? null;
          }
        }
      } else if (hit.object.userData.type === EntityType.OBSTACLE) {
        const id = hit.object.userData.id;
        entity = engine.obstacles.get(id) ?? null;
      }

      setHoveredEntity(entity);
    },
    [] // Коректні залежності
  );

  return {
    hoveredEntity,
    tooltipVisible,
    tooltipPos,
    onMouseMove,
    onClick,
    updateHoveredEntity,
  };
}
